// Deterministic randomness for fuzz: a string seed hashed (FNV-1a) into a
// mulberry32 generator. Same seed, same number, on every engine.

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A number in [0, 1) determined entirely by `seed`. */
export function uniform(seed: string): number {
  let t = (fnv1a(seed) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
