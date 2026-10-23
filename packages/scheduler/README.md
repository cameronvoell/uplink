# @uplink/scheduler

The FSRS-6 spaced-repetition scheduler Uplink runs on. It is plain TypeScript with no dependencies and no I/O. A review takes the current state, a grade, and the time, and returns the new state with its due date. No hidden clock and no hidden randomness, so the same review log always gives the same schedule.

FSRS-6 is the current model from [open-spaced-repetition](https://github.com/open-spaced-repetition). Why we chose it is in [plans/02](../../plans/02-is-fsrs-right.md), and how it works is in [plans/01](../../plans/01-spaced-repetition-background.md).

## API

```ts
import { review, preview, retrievability, replay, Good } from "@uplink/scheduler";

let card = review(null, Good, now);           // null = new item → { phase: "learning", step: 1, due: now + 10m, … }
card = review(card, Good, card.due);          // graduates: { phase: "review", stability ≈ 2.3, due: +2 days, … }
preview(card, now);                           // { 1: { due }, 2: { due }, 3: { due }, 4: { due } }: labels for the grade buttons
retrievability(card, now);                    // probability of recall now, 0–1 (null for a new item)
replay(events);                               // rebuild state from the review log; undo events cancel their target
review(card, Good, now, { desiredRetention: 0.95, maximumInterval: 30, fuzz: true });
```

Grades are `1` Again, `2` Hard, `3` Good, `4` Easy. A `CardState` holds `phase` (`learning`, `review`, `relearning`), `step`, `stability` (days), `difficulty` (1–10), `due`, `lastReview`, `reps`, and `lapses`. Options default to the FSRS-6 parameters, retention 0.9, a 36,500-day maximum, learning steps of 1 and 10 minutes, a 10-minute relearning step, and fuzz off. The package also exports the model's building blocks (`forgettingCurve`, `nextInterval`, `fuzzRange`, `DEFAULT_PARAMETERS`).

Review state belongs to the device and never goes into card files ([plans/05](../../plans/05-card-format.md)). This package only computes it.

## Tests

```sh
cd packages/scheduler
node --test "test/*.test.ts"     # or: npm test
```

Node 23.6 or later runs the TypeScript directly, with no build step and nothing to install. The suite has three parts:

- `test/golden.test.ts` checks results against **golden vectors** from the test suite of [py-fsrs](https://github.com/open-spaced-repetition/py-fsrs/blob/9446cb06605c597a063aeee49f7d188d42e34dc2/tests/test_basic.py) at commit `9446cb0` (MIT, © 2022 Open Spaced Repetition). These are a 13-review interval history, stability and difficulty after a fixed history, learning and relearning delays, and the difficulty floor. The source, commit, and licence are also recorded at the top of `test/vectors.ts`.
- `test/properties.test.ts` checks **properties** over seeded random histories. Retrievability falls over time and meets the target at the due date. Good never lowers stability. Again sends a review item to relearning. Difficulty stays within 1–10. Intervals respect the maximum. Fuzz stays in range and reproduces from its seed.
- `test/edge-cases.test.ts` covers **edge cases**: the first review, a review 1,000 days overdue, a same-day review, every grade from every phase, preview, and replay with undo.

## Behaviour notes

- The formulas and the learning-step rules follow py-fsrs. On a new item, Hard waits for the mean of the first two steps (5.5 minutes), and ts-fsrs rounds that to 6.
- Fuzz is off by default. When it is on, it spreads intervals of 3 days or more within FSRS's bands, and it never touches same-day steps. The seed comes from the review time, the rep count, and difficulty × stability, unless you pass `fuzzSeed`.
- Elapsed time counts whole 24-hour periods since the last review. Anything under a day uses FSRS-6's short-term stability update.

## Not implemented yet

- Parameter optimisation, which fits the 21 weights to a learner's history. That needs the optimiser in `fsrs-rs` and is planned server-side (plans/02).
- A day boundary at a local hour, such as 04:00. Days are 24-hour periods from the last review for now.
- FSRS-7.
- Running the golden vectors on a device under Hermes. That is the first task of the app stage.
- A cross-check against `ts-fsrs` on the same histories.
