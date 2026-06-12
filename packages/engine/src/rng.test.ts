import { describe, expect, it } from 'vitest';

import { defaultRng, mulberry32 } from './rng.js';

describe('mulberry32', () => {
  it('same seed produces the same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const sequenceA = [a.next(), a.next(), a.next(), a.next(), a.next()];
    const sequenceB = [b.next(), b.next(), b.next(), b.next(), b.next()];
    expect(sequenceA).toEqual(sequenceB);
  });

  it('different seeds produce different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const sequenceA = [a.next(), a.next(), a.next(), a.next(), a.next()];
    const sequenceB = [b.next(), b.next(), b.next(), b.next(), b.next()];
    expect(sequenceA).not.toEqual(sequenceB);
  });

  it('each call advances the state (no repeated first value)', () => {
    const rng = mulberry32(7);
    expect(rng.next()).not.toBe(rng.next());
  });

  it('always returns a number in [0, 1)', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('defaultRng', () => {
  it('returns numbers in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const value = defaultRng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
