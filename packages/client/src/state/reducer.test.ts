import { describe, expect, it } from 'vitest';
import { reducer, initialState, type Action } from './reducer';

describe('app reducer', () => {
  it('starts on the home screen, connecting, with no match', () => {
    expect(initialState.status).toBe('connecting');
    expect(initialState.screen).toBe('home');
    expect(initialState.match).toBeNull();
  });

  it('connected → status connected, screen and match untouched', () => {
    const next = reducer(initialState, { type: 'connected' });
    expect(next.status).toBe('connected');
    expect(next.screen).toBe('home');
    expect(next.match).toBeNull();
  });

  it('disconnected → status disconnected', () => {
    const connected = reducer(initialState, { type: 'connected' });
    const next = reducer(connected, { type: 'disconnected' });
    expect(next.status).toBe('disconnected');
  });

  it('match/joined → moves to the waiting screen and stores the match', () => {
    const action: Action = {
      type: 'match/joined',
      matchId: 'm-1',
      link: 'http://localhost:5173/?match=m-1',
      playerId: 'p-1',
      token: 't-1',
    };
    const next = reducer(initialState, action);
    expect(next.screen).toBe('waiting');
    expect(next.match).toEqual({
      matchId: 'm-1',
      link: 'http://localhost:5173/?match=m-1',
      playerId: 'p-1',
      token: 't-1',
    });
  });

  it('a later connected/disconnected does not knock you off the waiting screen', () => {
    const joined = reducer(initialState, {
      type: 'match/joined',
      matchId: 'm-1',
      link: 'l',
      playerId: 'p-1',
      token: 't-1',
    });
    const afterReconnect = reducer(joined, { type: 'connected' });
    expect(afterReconnect.screen).toBe('waiting');
    expect(afterReconnect.match).toEqual(joined.match);

    const afterDrop = reducer(joined, { type: 'disconnected' });
    expect(afterDrop.screen).toBe('waiting');
    expect(afterDrop.match).toEqual(joined.match);
  });

  it('does not mutate the input state', () => {
    const before = { ...initialState };
    reducer(before, { type: 'connected' });
    expect(before).toEqual(initialState);
  });
});
