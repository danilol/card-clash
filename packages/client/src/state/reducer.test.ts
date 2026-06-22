import { describe, expect, it } from 'vitest';
import { reducer, initialState } from './reducer';

describe('connection reducer', () => {
  it('starts as connecting', () => {
    expect(initialState.status).toBe('connecting');
  });

  it('connected action → connected', () => {
    const next = reducer(initialState, { type: 'connected' });
    expect(next.status).toBe('connected');
  });

  it('disconnected action → disconnected', () => {
    const next = reducer({ status: 'connected' }, { type: 'disconnected' });
    expect(next.status).toBe('disconnected');
  });

  it('does not mutate the input state', () => {
    const before = { status: 'connecting' as const };
    reducer(before, { type: 'connected' });
    expect(before.status).toBe('connecting'); // unchanged
  });
});
