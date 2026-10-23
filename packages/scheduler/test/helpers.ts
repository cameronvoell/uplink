import type { Grade } from "../src/index.ts";

export const MINUTE = 60_000;
export const DAY = 86_400_000;

export const addMs = (date: Date, ms: number): Date => new Date(date.getTime() + ms);

/** Whole days between two dates, truncated, as Python's timedelta.days does for positive gaps. */
export const wholeDays = (from: Date, to: Date): number => Math.floor((to.getTime() - from.getTime()) / DAY);

/** Small seeded PRNG (mulberry32) so property tests are reproducible. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomGrade = (rand: () => number): Grade => (1 + Math.floor(rand() * 4)) as Grade;

export const GRADES: readonly Grade[] = [1, 2, 3, 4];
