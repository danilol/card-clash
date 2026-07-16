import { describe, expect, it } from 'vitest';
import { createMatch, onePieceDeck, mulberry32 } from '@card-clash/engine';
import {
  createMatchEntry,
  getMatch,
  addPlayer,
  endMatch,
  findMatchBySocketId,
  deleteMatch,
} from './matchStore.js';

describe('matchStore', () => {
  it('createMatchEntry makes a waiting entry with an id, no players, and a timestamp', () => {
    const entry = createMatchEntry();
    expect(typeof entry.matchId).toBe('string');
    expect(entry.matchId.length).toBeGreaterThan(0);
    expect(entry.status).toBe('waiting');
    expect(entry.players).toEqual([]);
    expect(typeof entry.createdAt).toBe('number');
  });

  it('getMatch returns the entry by id, or undefined for an unknown id', () => {
    const entry = createMatchEntry();
    expect(getMatch(entry.matchId)).toBe(entry);
    expect(getMatch('does-not-exist')).toBeUndefined();
  });

  it('gives a unique id to each match', () => {
    const a = createMatchEntry();
    const b = createMatchEntry();
    expect(a.matchId).not.toBe(b.matchId);
  });

  it('addPlayer appends a player to the match', () => {
    const entry = createMatchEntry();
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

  it('endMatch persists the final state and flips status to ended', () => {
    const entry = createMatchEntry();
    const finalState = createMatch(onePieceDeck, ['p-1', 'p-2'], mulberry32(7));
    const ended = endMatch(entry.matchId, finalState);
    expect(ended.status).toBe('ended');
    expect(ended.state).toBe(finalState);
    expect(getMatch(entry.matchId)?.status).toBe('ended');
  });
});

describe('matchStore — story 2.6 helpers', () => {
  it('findMatchBySocketId returns the entry containing that socketId', () => {
    const entry = createMatchEntry();
    addPlayer(entry.matchId, {
      playerId: 'p-1',
      token: 't-1',
      nickname: 'Zoro',
      socketId: 's-zoro',
    });
    expect(findMatchBySocketId('s-zoro')).toBe(entry);
  });

  it('findMatchBySocketId returns undefined for an unknown socketId', () => {
    createMatchEntry();
    expect(findMatchBySocketId('s-nobody')).toBeUndefined();
  });

  it('deleteMatch evicts the entry: getMatch is undefined afterwards', () => {
    const entry = createMatchEntry();
    deleteMatch(entry.matchId);
    expect(getMatch(entry.matchId)).toBeUndefined();
  });

  it('deleteMatch on an unknown id is a safe no-op', () => {
    expect(() => deleteMatch('does-not-exist')).not.toThrow();
  });
});
