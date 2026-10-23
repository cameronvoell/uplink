// FSRS-6 scheduler: state + grade + time in, new state out. No clock, no
// randomness, no I/O. Review state lives on the device (doc 05); this package
// only computes it.

import {
  DEFAULT_PARAMETERS,
  forgettingCurve as curveAt,
  intervalDays,
  initialStability,
  initialDifficulty,
  nextDifficulty,
  shortTermStability,
  recallStability,
  forgetStability,
  fuzzRange,
} from "./fsrs.ts";
import type { Grade } from "./fsrs.ts";
import { uniform } from "./random.ts";

export { DEFAULT_PARAMETERS, fuzzRange };
export type { Grade };

export const Again = 1;
export const Hard = 2;
export const Good = 3;
export const Easy = 4;

export type Phase = "learning" | "review" | "relearning";

/** Scheduling state of one item. A new, unseen item has no state: `null`. */
export interface CardState {
  phase: Phase;
  /** Index into the learning or relearning steps; null in the review phase. */
  step: number | null;
  stability: number;
  difficulty: number;
  due: Date;
  lastReview: Date;
  reps: number;
  lapses: number;
}

export interface SchedulerOptions {
  /** 21 FSRS-6 weights. Default: DEFAULT_PARAMETERS. */
  parameters?: readonly number[];
  /** Target probability of recall at the due date. Default 0.9. */
  desiredRetention?: number;
  /** Longest interval in days. Default 36500. */
  maximumInterval?: number;
  /** Same-day steps for new items, in minutes. Default [1, 10]. */
  learningSteps?: readonly number[];
  /** Same-day steps after a lapse, in minutes. Default [10]. */
  relearningSteps?: readonly number[];
  /** Spread review intervals of 3 days or more. Default false. */
  fuzz?: boolean;
  /** Fuzz seed. Default: derived from the review time and the item's state, so a replay gives the same answer. */
  fuzzSeed?: string;
}

/** One entry of the append-only review log (doc 02). */
export interface ReviewEvent {
  id: string;
  cardId: string;
  reviewedAt: string;
  grade: Grade;
  durationMs?: number;
  undoes?: string;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

interface Settings {
  w: readonly number[];
  desiredRetention: number;
  maximumInterval: number;
  learningSteps: readonly number[];
  relearningSteps: readonly number[];
  fuzz: boolean;
  fuzzSeed: string | undefined;
}

function settings(options: SchedulerOptions = {}): Settings {
  const w = options.parameters ?? DEFAULT_PARAMETERS;
  if (w.length !== 21) throw new RangeError(`FSRS-6 needs 21 parameters, got ${w.length}`);
  const desiredRetention = options.desiredRetention ?? 0.9;
  if (!(desiredRetention > 0 && desiredRetention < 1)) throw new RangeError("desiredRetention must be in (0, 1)");
  const maximumInterval = options.maximumInterval ?? 36500;
  if (!(maximumInterval >= 1)) throw new RangeError("maximumInterval must be at least 1 day");
  return {
    w,
    desiredRetention,
    maximumInterval,
    learningSteps: options.learningSteps ?? [1, 10],
    relearningSteps: options.relearningSteps ?? [10],
    fuzz: options.fuzz ?? false,
    fuzzSeed: options.fuzzSeed,
  };
}

/** Whole days between two times, truncated; never negative. */
const elapsedDays = (from: Date, to: Date): number => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY));

/** Probability of recall after `elapsedDays` (fractional allowed) at the given stability. */
export function forgettingCurve(elapsedDays: number, stability: number, parameters?: readonly number[]): number {
  return curveAt(elapsedDays, stability, parameters ?? DEFAULT_PARAMETERS);
}

/** Whole-day interval for a stability, before fuzz. */
export function nextInterval(stability: number, options?: SchedulerOptions): number {
  const s = settings(options);
  return intervalDays(stability, s.desiredRetention, s.maximumInterval, s.w);
}

/** Probability of recall at `now`, counted in whole days since the last review. Null for a new item. */
export function retrievability(state: CardState | null, now: Date, options?: SchedulerOptions): number | null {
  if (state === null) return null;
  return curveAt(elapsedDays(state.lastReview, now), state.stability, settings(options).w);
}

/** Apply one grade at time `now`. Returns a new state; the input is not changed. */
export function review(state: CardState | null, grade: Grade, now: Date, options?: SchedulerOptions): CardState {
  if (![1, 2, 3, 4].includes(grade)) throw new RangeError(`grade must be 1–4, got ${grade}`);
  const s = settings(options);
  const { w } = s;

  // 1. Memory: stability and difficulty.
  let stability: number;
  let difficulty: number;
  if (state === null) {
    stability = initialStability(grade, w);
    difficulty = initialDifficulty(grade, w);
  } else {
    const days = elapsedDays(state.lastReview, now);
    if (days < 1) {
      stability = shortTermStability(state.stability, grade, w);
    } else {
      const r = curveAt(days, state.stability, w);
      stability =
        grade === Again
          ? forgetStability(state.difficulty, state.stability, r, w)
          : recallStability(state.difficulty, state.stability, r, grade, w);
    }
    difficulty = nextDifficulty(state.difficulty, grade, w);
  }

  // 2. Phase and wait.
  const phase: Phase = state?.phase ?? "learning";
  let next: { phase: Phase; step: number | null; waitMs: number | null }; // null wait: schedule by interval
  if (phase === "review") {
    next =
      grade === Again && s.relearningSteps.length > 0
        ? { phase: "relearning", step: 0, waitMs: s.relearningSteps[0] * MINUTE }
        : { phase: "review", step: null, waitMs: null };
  } else {
    const steps = phase === "learning" ? s.learningSteps : s.relearningSteps;
    next = stepThrough(phase, state?.step ?? 0, steps, grade);
  }

  const reps = (state?.reps ?? 0) + 1;
  const lapses = (state?.lapses ?? 0) + (phase === "review" && grade === Again ? 1 : 0);

  let waitMs: number;
  if (next.waitMs !== null) {
    waitMs = next.waitMs;
  } else {
    let days = intervalDays(stability, s.desiredRetention, s.maximumInterval, w);
    if (s.fuzz) days = fuzz(days, s, `${now.getTime()}:${reps}:${difficulty * stability}`);
    waitMs = days * DAY;
  }

  return {
    phase: next.phase,
    step: next.step,
    stability,
    difficulty,
    due: new Date(now.getTime() + waitMs),
    lastReview: new Date(now.getTime()),
    reps,
    lapses,
  };
}

/** Learning and relearning: walk the same-day steps, or graduate to review. */
function stepThrough(
  phase: Phase,
  step: number,
  steps: readonly number[],
  grade: Grade,
): { phase: Phase; step: number | null; waitMs: number | null } {
  const graduate = { phase: "review" as Phase, step: null, waitMs: null };
  if (steps.length === 0 || (step >= steps.length && grade !== Again)) return graduate;
  switch (grade) {
    case Again:
      return { phase, step: 0, waitMs: steps[0] * MINUTE };
    case Hard: {
      let minutes = steps[step];
      if (step === 0) minutes = steps.length === 1 ? steps[0] * 1.5 : (steps[0] + steps[1]) / 2;
      return { phase, step, waitMs: minutes * MINUTE };
    }
    case Good:
      if (step + 1 >= steps.length) return graduate;
      return { phase, step: step + 1, waitMs: steps[step + 1] * MINUTE };
    default:
      return graduate;
  }
}

function fuzz(days: number, s: Settings, derivedSeed: string): number {
  const { min, max } = fuzzRange(days, s.maximumInterval);
  if (max <= min) return days;
  const u = uniform(s.fuzzSeed ?? derivedSeed);
  return Math.min(min + Math.floor(u * (max - min + 1)), max);
}

/** Due date for each grade, as `review` would set it. Drives the labels on the grade buttons. */
export function preview(state: CardState | null, now: Date, options?: SchedulerOptions): Record<Grade, { due: Date }> {
  return {
    1: { due: review(state, Again, now, options).due },
    2: { due: review(state, Hard, now, options).due },
    3: { due: review(state, Good, now, options).due },
    4: { due: review(state, Easy, now, options).due },
  };
}

/**
 * Rebuild an item's state from its review log. Undo events and the reviews they
 * cancel are skipped; the rest are applied in (reviewedAt, id) order.
 * Returns null if nothing is left: the item is new.
 */
export function replay(events: readonly ReviewEvent[], options?: SchedulerOptions): CardState | null {
  const cancelled = new Set<string>();
  for (const e of events) if (e.undoes) cancelled.add(e.undoes);
  const live = events
    .filter((e) => !e.undoes && !cancelled.has(e.id))
    .map((e) => ({ e, at: Date.parse(e.reviewedAt) }))
    .sort((a, b) => a.at - b.at || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0));
  let state: CardState | null = null;
  for (const { e, at } of live) state = review(state, e.grade, new Date(at), options);
  return state;
}
