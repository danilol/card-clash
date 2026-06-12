export interface Rng {
  /**
   * Returns a float in [0, 1)
   */
  next(): number;
}

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
