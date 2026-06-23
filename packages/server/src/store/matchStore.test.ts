import { describe, expect, it } from 'vitest';
import { createMatch, getMatch, addPlayer } from './matchStore.js';

describe('matchStore', () => {
  it('createMatch makes a waiting entry with an id, no players, and a timestamp', () => {
    const entry = createMatch();
    expect(typeof entry.matchId).toBe('string');
    expect(entry.matchId.length).toBeGreaterThan(0);
    expect(entry.status).toBe('waiting');
    expect(entry.players).toEqual([]);
    expect(typeof entry.createdAt).toBe('number');
  });

  it('getMatch returns the entry by id, or undefined for an unknown id', () => {
    const entry = createMatch();
    expect(getMatch(entry.matchId)).toBe(entry);
    expect(getMatch('does-not-exist')).toBeUndefined();
  });

  it('gives a unique id to each match', () => {
    const a = createMatch();
    const b = createMatch();
    expect(a.matchId).not.toBe(b.matchId);
  });

  it('addPlayer appends a player to the match', () => {
    const entry = createMatch();
    const player = {
      playerId: 'p-1',
      token: 't-1',
      nickname: 'Luffy',
      socketId: 's-1',
    };
    const updated = addPlayer(entry.matchId, player);
    expect(updated.players).toHaveLength(1);
    expect(updated.players[0]).toEqual(player);
  });

  it('addPlayer throws for an unknown match', () => {
    expect(() =>
      addPlayer('does-not-exist', {
        playerId: 'p',
        token: 't',
        nickname: 'n',
        socketId: 's',
      }),
    ).toThrow();
  });
});
