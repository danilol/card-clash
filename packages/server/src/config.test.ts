import { describe, expect, it } from 'vitest';
import { configSchema } from './config.js';

describe('config schema (story 3.1, AC1)', () => {
  it('accepts a valid DATABASE_URL', () => {
    const parsed = configSchema.safeParse({
      DATABASE_URL: 'postgres://localhost:5432/card_clash_dev',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(configSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a non-URL DATABASE_URL', () => {
    expect(configSchema.safeParse({ DATABASE_URL: 'not a url' }).success).toBe(
      false,
    );
  });
});
