// Properties every FSRS-6 schedule must hold, checked over seeded random review histories.

import { test } from "node:test";
import assert from "node:assert/strict";

import { review, retrievability, forgettingCurve, nextInterval, fuzzRange, Again, Good, Easy } from "../src/index.ts";
import type { CardState, Grade, SchedulerOptions } from "../src/index.ts";
import { addMs, wholeDays, prng, randomGrade, DAY, MINUTE } from "./helpers.ts";

const START = new Date("2026-01-05T09:00:00Z");

/** Walk one random history: random grades, reviewed anywhere from a minute early-ish to well after due. */
function* randomHistory(seed: number, length: number, options?: SchedulerOptions) {
  const rand = prng(seed);
  let state: CardState | null = null;
  let now = START;
  for (let i = 0; i < length; i++) {
    const grade = randomGrade(rand);
    const before = state;
    state = review(state, grade, now, options);
    yield { before, grade, now, after: state };
    const wait = state.due.getTime() - now.getTime();
    // Review at 0.5×–3× the scheduled wait, at least one minute later.
    now = addMs(now, Math.max(MINUTE, Math.round(wait * (0.5 + rand() * 2.5))));
  }
}

test("retrievability falls as time passes", () => {
  for (const stability of [0.5, 2.3, 10, 120]) {
    let previous = 1;
    for (const days of [0, 0.5, 1, 2, 5, 30, 365, 3650]) {
      const r = forgettingCurve(days, stability);
      assert.ok(r <= previous, `S=${stability} t=${days}`);
      assert.ok(r > 0 && r <= 1);
      previous = r;
    }
  }
  assert.equal(forgettingCurve(0, 5), 1);
});

test("retrievability equals the desired retention when elapsed time equals the interval", () => {
  for (const retention of [0.8, 0.9, 0.95]) {
    for (const stability of [1, 3.7, 25, 400]) {
      const exact = nextInterval(stability, { desiredRetention: retention, maximumInterval: 1e9 });
      // nextInterval rounds to whole days; check the curve against the stability at retention 0.9,
      // where the unrounded interval equals the stability exactly.
      if (retention === 0.9) assert.ok(Math.abs(forgettingCurve(stability, stability) - 0.9) < 1e-12);
      assert.ok(exact >= 1);
    }
  }
  // After a real review, R at the due date is within rounding of the target.
  for (const { after } of randomHistory(7, 200)) {
    if (after.phase !== "review" || after.stability < 5) continue;
    const r = retrievability(after, after.due);
    assert.ok(r !== null && Math.abs(r - 0.9) < 0.01, `R at due ${r}, S=${after.stability}`);
  }
});

test("lower desired retention gives longer intervals", () => {
  const s = 30;
  const i80 = nextInterval(s, { desiredRetention: 0.8 });
  const i90 = nextInterval(s, { desiredRetention: 0.9 });
  const i95 = nextInterval(s, { desiredRetention: 0.95 });
  assert.ok(i80 > i90 && i90 > i95, `${i80} ${i90} ${i95}`);
  assert.equal(i90, 30);
});

test("a Good review never shrinks stability", () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const { after: state, now } of randomHistory(seed, 30)) {
      for (const offsetDays of [0, 0.01, 1, 7, 90]) {
        const later = addMs(now, offsetDays * DAY + MINUTE);
        const next = review(state, Good, later);
        assert.ok(next.stability >= state.stability, `seed ${seed}: ${state.stability} → ${next.stability}`);
      }
    }
  }
});

test("Again on a review card sends it to relearning and counts a lapse", () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const { after: state } of randomHistory(seed, 20)) {
      if (state.phase !== "review") continue;
      const next = review(state, Again, state.due);
      assert.equal(next.phase, "relearning");
      assert.equal(next.step, 0);
      assert.equal(next.lapses, state.lapses + 1);
      assert.ok(next.stability <= state.stability);
    }
  }
});

test("difficulty stays within [1, 10]", () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (const { after } of randomHistory(seed, 40)) {
      assert.ok(after.difficulty >= 1 && after.difficulty <= 10, `seed ${seed}: D=${after.difficulty}`);
    }
  }
});

test("Easy lowers difficulty and Again raises it", () => {
  const now = START;
  const card = review(null, Good, now, { learningSteps: [] });
  const later = addMs(card.due, 0);
  assert.ok(review(card, Easy, later).difficulty < card.difficulty);
  assert.ok(review(card, Again, later).difficulty > card.difficulty);
});

test("intervals respect the maximum", () => {
  for (const maximumInterval of [1, 7, 30, 365]) {
    for (let seed = 1; seed <= 20; seed++) {
      for (const { after } of randomHistory(seed, 40, { maximumInterval, fuzz: true })) {
        assert.ok(wholeDays(after.lastReview, after.due) <= maximumInterval, `cap ${maximumInterval}`);
      }
    }
  }
});

test("stability, difficulty and due are always finite and the due date is in the future", () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const { now, after } of randomHistory(seed, 40)) {
      assert.ok(Number.isFinite(after.stability) && after.stability > 0);
      assert.ok(Number.isFinite(after.difficulty));
      assert.ok(after.due.getTime() > now.getTime());
      assert.equal(after.lastReview.getTime(), now.getTime());
    }
  }
});

test("fuzz range matches FSRS's bands", () => {
  assert.deepEqual(fuzzRange(2, 36500), { min: 2, max: 2 }); // under 2.5 days: no fuzz
  assert.deepEqual(fuzzRange(3, 36500), { min: 2, max: 4 });
  assert.deepEqual(fuzzRange(10, 36500), { min: 8, max: 12 });
  assert.deepEqual(fuzzRange(30, 36500), { min: 27, max: 33 });
  assert.deepEqual(fuzzRange(100, 36500), { min: 93, max: 107 });
  assert.deepEqual(fuzzRange(100, 100), { min: 93, max: 100 });
});

test("fuzzed intervals stay in range and are reproducible from a seed", () => {
  const now = START;
  let card: CardState | null = null;
  // Build a review card with a long interval.
  for (const grade of [Good, Good, Good, Good] as Grade[]) {
    card = review(card, grade, card ? card.due : now, { fuzz: false });
  }
  const state = card as CardState;
  const at = state.due;
  const plain = wholeDays(at, review(state, Good, at, { fuzz: false }).due);
  const { min, max } = fuzzRange(plain, 36500);
  assert.ok(max > min, "test needs an interval long enough to fuzz");

  const seen = new Set<number>();
  for (let i = 0; i < 40; i++) {
    const fuzzSeed = `seed-${i}`;
    const a = review(state, Good, at, { fuzz: true, fuzzSeed });
    const b = review(state, Good, at, { fuzz: true, fuzzSeed });
    assert.equal(a.due.getTime(), b.due.getTime(), "same seed, same due date");
    const days = wholeDays(at, a.due);
    assert.ok(days >= min && days <= max, `${days} outside [${min}, ${max}]`);
    seen.add(days);
  }
  assert.ok(seen.size > 1, "different seeds spread the interval");

  // Without an explicit seed, the result is still a pure function of its inputs.
  const c = review(state, Good, at, { fuzz: true });
  const d = review(state, Good, at, { fuzz: true });
  assert.equal(c.due.getTime(), d.due.getTime());
});

test("fuzz never touches same-day learning steps", () => {
  const now = START;
  for (let i = 0; i < 10; i++) {
    const s = review(null, Good, now, { fuzz: true, fuzzSeed: String(i) });
    assert.equal(s.due.getTime() - now.getTime(), 10 * MINUTE);
  }
});
