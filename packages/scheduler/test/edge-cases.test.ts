// Edge cases: first review, long overdue, same day, every grade from every phase, preview, replay.

import { test } from "node:test";
import assert from "node:assert/strict";

import { review, preview, retrievability, replay, Again, Hard, Good, Easy } from "../src/index.ts";
import type { CardState, Grade, Phase, ReviewEvent } from "../src/index.ts";
import { addMs, wholeDays, GRADES, DAY, MINUTE } from "./helpers.ts";

const NOW = new Date("2026-03-02T08:00:00Z");

test("first review of a new card sets initial stability and difficulty from the grade", () => {
  // S0 = w[grade-1]; D0 = w4 - e^(w5 (grade-1)) + 1, clamped to [1, 10].
  const expected: Record<Grade, { s: number; d: number }> = {
    1: { s: 0.212, d: 6.4133 },
    2: { s: 1.2931, d: 6.4133 - Math.exp(0.8334) + 1 },
    3: { s: 2.3065, d: 6.4133 - Math.exp(0.8334 * 2) + 1 },
    4: { s: 8.2956, d: Math.max(1, 6.4133 - Math.exp(0.8334 * 3) + 1) },
  };
  for (const grade of GRADES) {
    const state = review(null, grade, NOW);
    assert.ok(Math.abs(state.stability - expected[grade].s) < 1e-9, `S0 for ${grade}`);
    assert.ok(Math.abs(state.difficulty - expected[grade].d) < 1e-9, `D0 for ${grade}`);
    assert.equal(state.reps, 1);
    assert.equal(state.lapses, 0);
    assert.equal(state.lastReview.getTime(), NOW.getTime());
  }
});

test("Easy on a new card graduates straight to an 8-day interval", () => {
  const state = review(null, Easy, NOW);
  assert.equal(state.phase, "review");
  assert.equal(state.step, null);
  assert.equal(wholeDays(NOW, state.due), 8);
});

test("a new card has no retrievability", () => {
  assert.equal(retrievability(null, NOW), null);
});

test("a long-overdue review stays finite, grows stability on success, and resets on failure", () => {
  let state = review(null, Easy, NOW);
  state = review(state, Good, state.due);
  const late = addMs(state.due, 1000 * DAY);
  const r = retrievability(state, late);
  assert.ok(r !== null && r > 0 && r < 0.5, `R after 1000 days late: ${r}`);

  const good = review(state, Good, late);
  assert.equal(good.phase, "review");
  assert.ok(good.stability > state.stability);
  assert.ok(Number.isFinite(good.stability));

  const again = review(state, Again, late);
  assert.equal(again.phase, "relearning");
  assert.ok(again.stability < state.stability);
});

test("a same-day review uses the short-term update and never schedules in the past", () => {
  let state = review(null, Easy, NOW, { learningSteps: [] });
  const sameDay = addMs(NOW, 3 * 60 * MINUTE);
  for (const grade of GRADES) {
    const next = review(state, grade, sameDay);
    assert.ok(next.due.getTime() > sameDay.getTime(), `grade ${grade}`);
    if (grade >= Hard) assert.ok(next.stability >= state.stability, `grade ${grade} same day`);
    else assert.ok(next.stability < state.stability, "Again same day lowers stability");
  }
  state = review(state, Good, sameDay);
  assert.equal(state.phase, "review");
});

/** Build a state in each phase with the default steps (1m, 10m; relearning 10m). */
function statesByPhase(): { label: string; state: CardState | null }[] {
  const learning0 = review(null, Again, NOW); // step 0
  const learning1 = review(null, Good, NOW); // step 1
  const reviewing = review(learning1, Good, learning1.due);
  const relearning = review(reviewing, Again, reviewing.due);
  return [
    { label: "new", state: null },
    { label: "learning step 0", state: learning0 },
    { label: "learning step 1", state: learning1 },
    { label: "review", state: reviewing },
    { label: "relearning step 0", state: relearning },
  ];
}

// Expected phase and wait for every grade from every phase, default steps.
const transitions: Record<string, Record<Grade, { phase: Phase; waitMs?: number }>> = {
  new: {
    1: { phase: "learning", waitMs: 1 * MINUTE },
    2: { phase: "learning", waitMs: 5.5 * MINUTE },
    3: { phase: "learning", waitMs: 10 * MINUTE },
    4: { phase: "review" },
  },
  "learning step 0": {
    1: { phase: "learning", waitMs: 1 * MINUTE },
    2: { phase: "learning", waitMs: 5.5 * MINUTE },
    3: { phase: "learning", waitMs: 10 * MINUTE },
    4: { phase: "review" },
  },
  "learning step 1": {
    1: { phase: "learning", waitMs: 1 * MINUTE },
    2: { phase: "learning", waitMs: 10 * MINUTE },
    3: { phase: "review" },
    4: { phase: "review" },
  },
  review: {
    1: { phase: "relearning", waitMs: 10 * MINUTE },
    2: { phase: "review" },
    3: { phase: "review" },
    4: { phase: "review" },
  },
  "relearning step 0": {
    1: { phase: "relearning", waitMs: 10 * MINUTE },
    2: { phase: "relearning", waitMs: 15 * MINUTE },
    3: { phase: "review" },
    4: { phase: "review" },
  },
};

test("every grade from every phase lands in the expected phase", () => {
  for (const { label, state } of statesByPhase()) {
    const at = state ? state.due : NOW;
    for (const grade of GRADES) {
      const next = review(state, grade, at);
      const want = transitions[label][grade];
      assert.equal(next.phase, want.phase, `${label}, grade ${grade}`);
      assert.equal(next.step === null, want.phase === "review", `${label}, grade ${grade}: step`);
      const wait = next.due.getTime() - at.getTime();
      if (want.waitMs !== undefined) assert.equal(wait, want.waitMs, `${label}, grade ${grade}: wait`);
      else assert.ok(wait >= DAY && wait % DAY === 0, `${label}, grade ${grade}: whole days`);
      assert.ok(next.difficulty >= 1 && next.difficulty <= 10);
      assert.equal(next.reps, (state?.reps ?? 0) + 1);
    }
  }
});

test("review intervals rise with the grade: Hard ≤ Good ≤ Easy", () => {
  for (const { label, state } of statesByPhase()) {
    if (state?.phase !== "review") continue;
    const p = preview(state, state.due);
    assert.ok(p[Hard].due <= p[Good].due && p[Good].due <= p[Easy].due, label);
  }
});

test("review does not mutate its input", () => {
  const state = review(null, Good, NOW);
  const copy = structuredClone(state);
  review(state, Easy, state.due);
  assert.deepEqual(state, copy);
});

test("preview gives the due date for each grade without changing anything", () => {
  const p = preview(null, NOW);
  assert.equal(p[Again].due.getTime() - NOW.getTime(), 1 * MINUTE);
  assert.equal(p[Hard].due.getTime() - NOW.getTime(), 5.5 * MINUTE);
  assert.equal(p[Good].due.getTime() - NOW.getTime(), 10 * MINUTE);
  assert.equal(wholeDays(NOW, p[Easy].due), 8);
  for (const grade of GRADES) {
    assert.equal(p[grade].due.getTime(), review(null, grade, NOW).due.getTime());
  }
});

const event = (id: string, reviewedAt: Date, grade: Grade, undoes?: string): ReviewEvent => ({
  id,
  cardId: "01JB0000000000000000000000",
  reviewedAt: reviewedAt.toISOString(),
  grade,
  ...(undoes ? { undoes } : {}),
});

test("replay of a review log equals reviewing step by step", () => {
  let state: CardState | null = null;
  let now = NOW;
  const events: ReviewEvent[] = [];
  const grades: Grade[] = [Good, Good, Good, Again, Hard, Good, Easy, Good];
  grades.forEach((grade, i) => {
    state = review(state, grade, now);
    events.push(event(`01JB00000000000000000000${String(i).padStart(2, "0")}`, now, grade));
    now = addMs(state.due, 3 * 60 * MINUTE);
  });
  assert.deepEqual(replay(events), state);
  // Order in the log does not matter: replay sorts by (reviewedAt, id).
  assert.deepEqual(replay([...events].reverse()), state);
});

test("replay skips an undone review and its undo event", () => {
  const t0 = NOW;
  const first = review(null, Good, t0);
  const t1 = first.due;
  const events = [
    event("01JB0000000000000000000001", t0, Good),
    event("01JB0000000000000000000002", t1, Again),
    event("01JB0000000000000000000003", addMs(t1, 5000), Good, "01JB0000000000000000000002"),
  ];
  assert.deepEqual(replay(events), first);
});

test("replay of an empty log, or one where everything was undone, is a new card", () => {
  assert.equal(replay([]), null);
  const events = [
    event("01JB0000000000000000000001", NOW, Good),
    event("01JB0000000000000000000002", addMs(NOW, 1000), Good, "01JB0000000000000000000001"),
  ];
  assert.equal(replay(events), null);
});
