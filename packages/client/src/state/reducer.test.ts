import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@card-clash/engine';
import { reducer, initialState, type Action } from './reducer';

describe('app reducer', () => {
  it('starts connecting, with no match and no view', () => {
    expect(initialState.status).toBe('connecting');
    expect(initialState.match).toBeNull();
    expect(initialState.view).toBeNull();
  });

  it('connected → status connected, screen and match untouched', () => {
    const next = reducer(initialState, { type: 'connected' });
    expect(next.status).toBe('connected');
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
      nickname: 'Player 1',
      playerId: 'p-1',
      token: 't-1',
    };
    const next = reducer(initialState, action);
    expect(next.screen).toBe('waiting');
    expect(next.match).toEqual({
      matchId: 'm-1',
      link: 'http://localhost:5173/?match=m-1',
      nickname: 'Player 1',
      playerId: 'p-1',
      token: 't-1',
    });
  });

  it('match/state → moves to the match screen and stores the view', () => {
    const view = {
      you: 'p-1',
      yourTopCard: null,
      yourStackCount: 16,
      opponentStackCount: 16,
      potCount: 0,
      chooser: 'p-1',
      yourTopCardIsSuperTrump: false,
      statDefinitions: [],
      lastRound: null,
      result: null,
    } as unknown as PlayerView;

    const next = reducer(initialState, { type: 'match/state', view });
    expect(next.screen).toBe('match');
    expect(next.view).toBe(view);
  });

  it('a later connected/disconnected does not knock you off the waiting screen', () => {
    const joined = reducer(initialState, {
      type: 'match/joined',
      matchId: 'm-1',
      link: 'l',
      nickname: 'Player 1',
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
