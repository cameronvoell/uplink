// Public API of the scheduler package. Implementation pending: every function
// throws until the FSRS-6 core lands, so the test suite runs and fails.

export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export const Again = 1;
export const Hard = 2;
export const Good = 3;
export const Easy = 4;

export type Phase = "learning" | "review" | "relearning";

/** Scheduling state of one item. `null` everywhere means a new, unseen item. */
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
  /** Target probability of recall at the due date, 0.7–0.99. Default 0.9. */
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

export interface ReviewEvent {
  id: string;
  cardId: string;
  reviewedAt: string;
  grade: Grade;
  durationMs?: number;
  undoes?: string;
}

const notImplemented = (): never => {
  throw new Error("not implemented");
};

export const DEFAULT_PARAMETERS: readonly number[] = [];

export function review(_state: CardState | null, _grade: Grade, _now: Date, _options?: SchedulerOptions): CardState {
  return notImplemented();
}

export function preview(_state: CardState | null, _now: Date, _options?: SchedulerOptions): Record<Grade, { due: Date }> {
  return notImplemented();
}

export function retrievability(_state: CardState | null, _now: Date, _options?: SchedulerOptions): number | null {
  return notImplemented();
}

export function forgettingCurve(_elapsedDays: number, _stability: number, _parameters?: readonly number[]): number {
  return notImplemented();
}

export function nextInterval(_stability: number, _options?: SchedulerOptions): number {
  return notImplemented();
}

export function fuzzRange(_intervalDays: number, _maximumInterval: number): { min: number; max: number } {
  return notImplemented();
}

export function replay(_events: readonly ReviewEvent[], _options?: SchedulerOptions): CardState | null {
  return notImplemented();
}
