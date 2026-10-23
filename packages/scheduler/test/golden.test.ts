// Golden vectors: our results must match py-fsrs's own tests (see vectors.ts for the source).

import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PARAMETERS, review, Good, Hard, Easy } from "../src/index.ts";
import type { CardState } from "../src/index.ts";
import { addMs, wholeDays, DAY, MINUTE } from "./helpers.ts";
import {
  PY_FSRS_DEFAULT_PARAMETERS,
  reviewAtDue,
  memoState,
  repeatedEasy,
  firstReviewDelayMs,
  relearningDelayMs,
  maximumIntervalCap,
} from "./vectors.ts";

test("default parameters are FSRS-6's 21 weights", () => {
  assert.deepEqual([...DEFAULT_PARAMETERS], [...PY_FSRS_DEFAULT_PARAMETERS]);
});

test("reviewing at each due date gives py-fsrs's interval history", () => {
  let state: CardState | null = null;
  let now = reviewAtDue.start;
  const intervals: number[] = [];
  for (const grade of reviewAtDue.grades) {
    state = review(state, grade, now, { fuzz: false });
    intervals.push(wholeDays(now, state.due));
    now = state.due;
  }
  assert.deepEqual(intervals, reviewAtDue.intervalDays);
});

test("the same history with explicit retention 0.9 and cap 36500 is unchanged", () => {
  let state: CardState | null = null;
  let now = reviewAtDue.start;
  const intervals: number[] = [];
  for (const grade of reviewAtDue.grades) {
    state = review(state, grade, now, { fuzz: false, desiredRetention: 0.9, maximumInterval: 36500 });
    intervals.push(wholeDays(now, state.due));
    now = state.due;
  }
  assert.deepEqual(intervals, reviewAtDue.intervalDays);
});

test("stability and difficulty after a fixed review history match py-fsrs", () => {
  let state: CardState | null = null;
  let now = memoState.start;
  memoState.grades.forEach((grade, i) => {
    now = addMs(now, memoState.gapDays[i] * DAY);
    state = review(state, grade, now);
  });
  assert.ok(state);
  const s = state as CardState;
  assert.ok(Math.abs(s.stability - memoState.stability) <= memoState.tolerance, `stability ${s.stability}`);
  assert.ok(Math.abs(s.difficulty - memoState.difficulty) <= memoState.tolerance, `difficulty ${s.difficulty}`);
});

test("ten same-day Easy grades drive difficulty to exactly 1", () => {
  let state: CardState | null = null;
  for (let i = 0; i < repeatedEasy.count; i++) {
    state = review(state, Easy, addMs(repeatedEasy.start, i), { fuzz: false });
  }
  assert.equal(state?.difficulty, repeatedEasy.difficulty);
});

test("first grade on a new card waits for the learning step", () => {
  const now = new Date("2022-11-29T12:30:00Z");
  for (const [grade, ms] of Object.entries(firstReviewDelayMs)) {
    const state = review(null, Number(grade) as 1 | 2 | 3, now);
    assert.equal(state.phase, "learning", `grade ${grade}`);
    assert.equal(state.due.getTime() - now.getTime(), ms, `grade ${grade}`);
  }
});

test("Good after the last learning step graduates for at least a day", () => {
  let now = new Date("2022-11-29T12:30:00Z");
  let state = review(null, Good, now);
  now = state.due;
  state = review(state, Good, now);
  assert.equal(state.phase, "review");
  assert.ok(state.due.getTime() - now.getTime() >= DAY);
});

test("Again on a review card relearns for ten minutes", () => {
  let now = new Date("2022-11-29T12:30:00Z");
  let state = review(null, Easy, now);
  assert.equal(state.phase, "review");
  now = state.due;
  state = review(state, 1, now);
  assert.equal(state.phase, "relearning");
  assert.equal(state.step, 0);
  assert.equal(state.due.getTime() - now.getTime(), relearningDelayMs);
  now = state.due;
  state = review(state, 1, now);
  assert.equal(state.phase, "relearning");
  assert.equal(state.due.getTime() - now.getTime(), relearningDelayMs);
  now = state.due;
  state = review(state, Good, now);
  assert.equal(state.phase, "review");
});

test("a same-day Hard does not lower stability (no learning steps)", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const first = review(null, Good, now, { learningSteps: [] });
  const second = review(first, Hard, addMs(now, MINUTE), { learningSteps: [] });
  assert.equal(second.stability, first.stability);
});

test("no interval exceeds a maximum of 100 days", () => {
  const options = { maximumInterval: maximumIntervalCap, fuzz: true };
  let state: CardState | null = null;
  let now = new Date("2022-11-29T12:30:00Z");
  for (const grade of [...reviewAtDue.grades, Easy, Easy, Easy, Easy]) {
    state = review(state, grade, now, options);
    assert.ok(wholeDays(state.lastReview, state.due) <= maximumIntervalCap);
    now = state.due;
  }
});
