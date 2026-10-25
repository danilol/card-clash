import { describe, expect, it } from 'vitest';
import { beginShutdown, isShuttingDown } from './lifecycle.js';

describe('server lifecycle (story 4.2 review)', () => {
  it('starts not shutting down; the first beginShutdown wins, later ones are no-ops', () => {
    expect(isShuttingDown()).toBe(false);
    expect(beginShutdown()).toBe(true);
    expect(isShuttingDown()).toBe(true);
    expect(beginShutdown()).toBe(false);
  });
});
