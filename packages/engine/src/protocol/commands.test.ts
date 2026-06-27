import { describe, expect, it } from 'vitest';
import { selectStatCommandSchema } from './commands.js';

describe('selectStatCommandSchema', () => {
  it('accepts a well-formed selectStat payload', () => {
    const result = selectStatCommandSchema.safeParse({
      matchId: 'm-1',
      token: 't-1',
      stat: 'haki',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown stat', () => {
    const result = selectStatCommandSchema.safeParse({
      matchId: 'm-1',
      token: 't-1',
      stat: 'charisma',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing stat', () => {
    const result = selectStatCommandSchema.safeParse({
      matchId: 'm-1',
      token: 't-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing token (the impersonation guard)', () => {
    const result = selectStatCommandSchema.safeParse({
      matchId: 'm-1',
      stat: 'haki',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all eight stat keys', () => {
    for (const stat of [
      'bounty',
      'age',
      'haki',
      'loyalty',
      'devilFruitMastery',
      'fearFactor',
      'speed',
      'battleIQ',
    ]) {
      const result = selectStatCommandSchema.safeParse({
        matchId: 'm-1',
        token: 't-1',
        stat,
      });
      expect(result.success).toBe(true);
    }
  });
});
