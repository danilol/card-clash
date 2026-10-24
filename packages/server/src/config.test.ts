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

  it('rejects a non-postgres scheme (story 3.1 review)', () => {
    expect(
      configSchema.safeParse({ DATABASE_URL: 'https://example.com/db' })
        .success,
    ).toBe(false);
  });

  it('accepts the postgresql:// scheme variant', () => {
    expect(
      configSchema.safeParse({
        DATABASE_URL: 'postgresql://localhost:5432/card_clash_dev',
      }).success,
    ).toBe(true);
  });
});

describe('config schema: PORT (story 4.2, 1d)', () => {
  const DATABASE_URL = 'postgres://localhost:5432/card_clash_dev';

  it('defaults PORT to 3000 when unset (local dev)', () => {
    const parsed = configSchema.safeParse({ DATABASE_URL });
    expect(parsed.success && parsed.data.PORT).toBe(3000);
  });

  it('parses PORT from its env string (Render sets it)', () => {
    const parsed = configSchema.safeParse({ DATABASE_URL, PORT: '10000' });
    expect(parsed.success && parsed.data.PORT).toBe(10000);
  });

  it('rejects a non-number PORT', () => {
    expect(configSchema.safeParse({ DATABASE_URL, PORT: 'abc' }).success).toBe(
      false,
    );
  });

  it('rejects an out-of-range PORT', () => {
    expect(
      configSchema.safeParse({ DATABASE_URL, PORT: '70000' }).success,
    ).toBe(false);
  });
});
