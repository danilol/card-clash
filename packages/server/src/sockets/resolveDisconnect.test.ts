import { describe, expect, it } from 'vitest';
import type { MatchEntry, Player, EntryStatus } from '../store/matchStore.js';
import { resolveDisconnect } from './resolveDisconnect.js';

const ALICE: Player = {
  playerId: 'p-alice',
  token: 't-alice',
  nickname: 'Alice',
  socketId: 's-alice',
};
const BOB: Player = {
  playerId: 'p-bob',
  token: 't-bob',
  nickname: 'Bob',
  socketId: 's-bob',
};

function makeEntry(status: EntryStatus, players: Player[]): MatchEntry {
  return {
    matchId: 'm-1',
    status,
    players,
    createdAt: 0,
    state: null,
    rematchAccepted: [],
  };
}

describe('resolveDisconnect (story 2.6, decision 6d)', () => {
  it('playing → forfeit: the OTHER player wins', () => {
    const entry = makeEntry('playing', [ALICE, BOB]);
    expect(resolveDisconnect(entry, ALICE.socketId)).toEqual({
      kind: 'forfeit',
      winnerId: BOB.playerId,
      remainingSocketId: BOB.socketId,
    });
  });

  it('playing → forfeit works for either player disconnecting', () => {
    const entry = makeEntry('playing', [ALICE, BOB]);
    expect(resolveDisconnect(entry, BOB.socketId)).toEqual({
      kind: 'forfeit',
      winnerId: ALICE.playerId,
      remainingSocketId: ALICE.socketId,
    });
  });

  it('waiting (creator alone in the lobby) → abandon', () => {
    const entry = makeEntry('waiting', [ALICE]);
    expect(resolveDisconnect(entry, ALICE.socketId)).toEqual({
      kind: 'abandon',
    });
  });

  it('ended (both on the result screen) → opponentLeft with the remaining socket', () => {
    const entry = makeEntry('ended', [ALICE, BOB]);
    expect(resolveDisconnect(entry, ALICE.socketId)).toEqual({
      kind: 'opponentLeft',
      remainingSocketId: BOB.socketId,
    });
  });

  it('socket not in the entry → none', () => {
    const entry = makeEntry('playing', [ALICE, BOB]);
    expect(resolveDisconnect(entry, 's-stranger')).toEqual({ kind: 'none' });
  });
});
