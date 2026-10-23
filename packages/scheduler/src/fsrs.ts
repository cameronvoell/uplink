// The FSRS-6 memory model: forgetting curve, intervals, and the stability and
// difficulty updates. Pure maths, no dates. Formulas follow py-fsrs's
// scheduler.py (MIT), which the golden vectors in test/vectors.ts come from.

/** FSRS-6 default weights w0–w20. */
export const DEFAULT_PARAMETERS: readonly number[] = Object.freeze([
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614,
  0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
]);

export const STABILITY_MIN = 0.001;
export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;

/** 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Grade = 1 | 2 | 3 | 4;

const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);

/** Python's round(): halves go to the even neighbour. Matters for intervals like 2.5 days. */
export function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** The curve's shape: R = (1 + factor · t / S)^decay, chosen so R = 0.9 when t = S. */
export function curve(w: readonly number[]): { decay: number; factor: number } {
  const decay = -w[20];
  return { decay, factor: Math.pow(0.9, 1 / decay) - 1 };
}

/** Probability of recall after `elapsedDays` for a memory of the given stability. */
export function forgettingCurve(elapsedDays: number, stability: number, w: readonly number[] = DEFAULT_PARAMETERS): number {
  const { decay, factor } = curve(w);
  return Math.pow(1 + (factor * elapsedDays) / stability, decay);
}

/** Days until recall probability falls to `desiredRetention`, rounded, clamped to [1, maximumInterval]. */
export function intervalDays(stability: number, desiredRetention: number, maximumInterval: number, w: readonly number[]): number {
  const { decay, factor } = curve(w);
  const raw = (stability / factor) * (Math.pow(desiredRetention, 1 / decay) - 1);
  return Math.min(Math.max(roundHalfEven(raw), 1), maximumInterval);
}

export function initialStability(grade: Grade, w: readonly number[]): number {
  return Math.max(w[grade - 1], STABILITY_MIN);
}

function rawInitialDifficulty(grade: Grade, w: readonly number[]): number {
  return w[4] - Math.exp(w[5] * (grade - 1)) + 1;
}

export function initialDifficulty(grade: Grade, w: readonly number[]): number {
  return clamp(rawInitialDifficulty(grade, w), MIN_DIFFICULTY, MAX_DIFFICULTY);
}

/** Grade moves difficulty (damped near 10), then it reverts slightly towards the Easy starting point. */
export function nextDifficulty(difficulty: number, grade: Grade, w: readonly number[]): number {
  const delta = -w[6] * (grade - 3);
  const damped = difficulty + ((10 - difficulty) * delta) / 9;
  const reverted = w[7] * rawInitialDifficulty(4, w) + (1 - w[7]) * damped;
  return clamp(reverted, MIN_DIFFICULTY, MAX_DIFFICULTY);
}

/** Same-day review (under a day since the last one). Only Again can lower stability. */
export function shortTermStability(stability: number, grade: Grade, w: readonly number[]): number {
  let increase = Math.exp(w[17] * (grade - 3 + w[18])) * Math.pow(stability, -w[19]);
  if (grade >= 2) increase = Math.max(increase, 1);
  return Math.max(stability * increase, STABILITY_MIN);
}

/** Successful review (Hard, Good, Easy) after a day or more. */
export function recallStability(difficulty: number, stability: number, r: number, grade: Grade, w: readonly number[]): number {
  const hardPenalty = grade === 2 ? w[15] : 1;
  const easyBonus = grade === 4 ? w[16] : 1;
  const growth =
    Math.exp(w[8]) *
    (11 - difficulty) *
    Math.pow(stability, -w[9]) *
    (Math.exp((1 - r) * w[10]) - 1) *
    hardPenalty *
    easyBonus;
  return Math.max(stability * (1 + growth), STABILITY_MIN);
}

/** Lapse (Again) after a day or more. Never above what a same-day Again would give. */
export function forgetStability(difficulty: number, stability: number, r: number, w: readonly number[]): number {
  const longTerm =
    w[11] * Math.pow(difficulty, -w[12]) * (Math.pow(stability + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
  const shortTermCap = stability / Math.exp(w[17] * w[18]);
  return Math.max(Math.min(longTerm, shortTermCap), STABILITY_MIN);
}

/** Bands from FSRS: intervals of 2.5 days or more spread by a share of their length. */
const FUZZ_RANGES = [
  { start: 2.5, end: 7, factor: 0.15 },
  { start: 7, end: 20, factor: 0.1 },
  { start: 20, end: Infinity, factor: 0.05 },
];

/** Inclusive range of whole-day intervals that fuzz may pick for `interval`. */
export function fuzzRange(interval: number, maximumInterval: number): { min: number; max: number } {
  if (interval < 2.5) return { min: interval, max: interval };
  let delta = 1;
  for (const { start, end, factor } of FUZZ_RANGES) {
    delta += factor * Math.max(Math.min(interval, end) - start, 0);
  }
  const max = Math.min(roundHalfEven(interval + delta), maximumInterval);
  const min = Math.min(Math.max(2, roundHalfEven(interval - delta)), max);
  return { min, max };
}
