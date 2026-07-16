import { describe, expect, it } from 'vitest';
import {
  createMatch,
  forfeitMatch,
  mulberry32,
  onePieceDeck,
} from '@card-clash/engine';
import type { MatchEntry } from '../store/matchStore.js';
import { rowToRecentMatch, toMatchRecord } from './matchRecord.js';

const ALICE = {
  playerId: 'p-alice',
  token: 't-a',
  nickname: 'Alice',
  socketId: 's-a',
};
const BOB = {
  playerId: 'p-bob',
  token: 't-b',
  nickname: 'Bob',
  socketId: 's-b',
};

function makeEntry(state: MatchEntry['state']): MatchEntry {
  return {
    matchId: 'm-1',
    status: 'ended',
    players: [ALICE, BOB],
    createdAt: 0,
    state,
    rematchAccepted: [],
  };
}

function finishedState(winner: string, reason: 'allCards' | 'roundCap') {
  const state = createMatch(
    onePieceDeck,
    [ALICE.playerId, BOB.playerId],
    mulberry32(1),
  );
  return { ...state, roundsPlayed: 12, result: { winner, reason } };
}

describe('toMatchRecord (story 3.1, decision 2e)', () => {
  it('maps a rules ending to a camelCase record', () => {
    const state = finishedState(BOB.playerId, 'allCards');
    expect(toMatchRecord(makeEntry(state), state)).toEqual({
      playerOneNickname: 'Alice',
      playerTwoNickname: 'Bob',
      winnerNickname: 'Bob',
      endReason: 'allCards',
      roundsPlayed: 12,
    });
  });

  it('maps a forfeit ending (forfeitMatch state, reason verbatim)', () => {
    const base = createMatch(
      onePieceDeck,
      [ALICE.playerId, BOB.playerId],
      mulberry32(2),
    );
    const forfeited = forfeitMatch(
      { ...base, roundsPlayed: 3 },
      ALICE.playerId,
    );
    const record = toMatchRecord(makeEntry(null), forfeited);
    expect(record).toEqual({
      playerOneNickname: 'Alice',
      playerTwoNickname: 'Bob',
      winnerNickname: 'Alice',
      endReason: 'forfeit',
      roundsPlayed: 3,
    });
  });

  it('returns null when the state has no result', () => {
    const unfinished = createMatch(
      onePieceDeck,
      [ALICE.playerId, BOB.playerId],
      mulberry32(3),
    );
    expect(toMatchRecord(makeEntry(unfinished), unfinished)).toBeNull();
  });

  it('returns null when the winner is not among the players', () => {
    const state = finishedState('p-stranger', 'roundCap');
    expect(toMatchRecord(makeEntry(state), state)).toBeNull();
  });
});

describe('rowToRecentMatch (story 3.2, decision 1b)', () => {
  it('maps a snake_case row to camelCase with ISO date and numeric id', () => {
    const row = {
      id: '42', // pg returns BIGINT as a string
      player_one_nickname: 'Luffy',
      player_two_nickname: 'Zoro',
      winner_nickname: 'Zoro',
      end_reason: 'forfeit' as const,
      rounds_played: 7,
      created_at: new Date('2026-07-16T12:34:56.000Z'),
    };
    expect(rowToRecentMatch(row)).toEqual({
      id: 42,
      playerOneNickname: 'Luffy',
      playerTwoNickname: 'Zoro',
      winnerNickname: 'Zoro',
      endReason: 'forfeit',
      roundsPlayed: 7,
      createdAt: '2026-07-16T12:34:56.000Z',
    });
  });
});
