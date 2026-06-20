export interface Rng {
  /**
   * Returns a float in [0, 1)
   */
  next(): number;
}

/**
 * mulberry32 is a small, fast seeded random number generator (a "PRNG").
 *
 * Normal randomness (like Math.random) gives different results every run.
 * This one is "seeded": you give it a starting number (the seed `a`), and it
 * always produces the exact same sequence of numbers for that seed.
 *
 * That is what we want for a card game: with the same seed, the deck shuffles
 * and deals the same way every time. This makes matches reproducible — we can
 * replay a game or write tests that check an exact outcome.
 *
 * Each call to `next()` returns a float in [0, 1), just like Math.random.
 *
 * The bit math below (Math.imul, ^, >>>) is the mulberry32 algorithm. It mixes
 * the internal state to look random. You don't need to understand the exact
 * steps to use it — just know: same seed in, same numbers out.
 *
 * @param a - the seed; the same seed always yields the same sequence
 */
export function mulberry32(a: number): Rng {
  return {
    next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export const defaultRng: Rng = { next: Math.random };
