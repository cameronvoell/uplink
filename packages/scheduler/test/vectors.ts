// Golden vectors for FSRS-6, taken from the py-fsrs test suite.
//
// Source:  https://github.com/open-spaced-repetition/py-fsrs/blob/9446cb06605c597a063aeee49f7d188d42e34dc2/tests/test_basic.py
//          (default parameters from fsrs/scheduler.py on the same repository)
// Commit:  9446cb06605c597a063aeee49f7d188d42e34dc2 (2026-08-09, "Fix Ruff autofix failures (#156)")
// License: MIT, Copyright (c) 2022 Open Spaced Repetition. MIT-compatible with this repo (MIT).
//
// The values below are facts copied from those tests (ratings, dates, expected
// intervals, stability, difficulty), restated as data. Where a py-fsrs test
// uses microsecond offsets, these use millisecond offsets: both fall on the
// same day, which is all the test depends on.

import type { Grade } from "../src/index.ts";

/** FSRS-6 default weights w0–w20 (py-fsrs DEFAULT_PARAMETERS). */
export const PY_FSRS_DEFAULT_PARAMETERS = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614,
  0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
] as const;

const G: Grade = 3;
const A: Grade = 1;

/**
 * test_review_card and test_custom_scheduler_args: a new card, fuzz off,
 * default steps, reviewed at each due date in turn. Expected whole-day
 * interval after each review (0 means a same-day learning step).
 */
export const reviewAtDue = {
  start: new Date("2022-11-29T12:30:00Z"),
  grades: [G, G, G, G, G, G, A, A, G, G, G, G, G] as Grade[],
  intervalDays: [0, 2, 11, 46, 163, 498, 0, 0, 2, 4, 7, 12, 21],
};

/**
 * test_memo_state: reviews at fixed day offsets from the start, applied one
 * after another (each offset is added to the previous review time).
 */
export const memoState = {
  start: new Date("2022-11-29T12:30:00Z"),
  grades: [A, G, G, G, G, G] as Grade[],
  gapDays: [0, 0, 1, 3, 8, 21],
  stability: 53.62691,
  difficulty: 6.3574867,
  tolerance: 1e-4,
};

/** test_repeated_correct_reviews: ten Easy grades on the same day drive difficulty to its floor. */
export const repeatedEasy = {
  start: new Date("2022-11-29T12:30:00Z"),
  count: 10,
  difficulty: 1.0,
};

/** test_good/again/hard_learning_steps: first grade on a new card, default steps. */
export const firstReviewDelayMs = {
  1: 60_000, // Again: first step, 1 minute
  2: 330_000, // Hard: mean of the first two steps, 5.5 minutes
  3: 600_000, // Good: second step, 10 minutes
} as const;

/** test_review_state / test_relearning: Again on a review card relearns for 10 minutes. */
export const relearningDelayMs = 600_000;

/** test_maximum_interval uses a cap of 100 days. */
export const maximumIntervalCap = 100;
