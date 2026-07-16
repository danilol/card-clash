import { describe, expect, it, vi } from 'vitest';
import { createMatch, mulberry32, onePieceDeck } from '@card-clash/engine';
import type { MatchEntry } from '../store/matchStore.js';
import { persistFinishedMatch } from './persistFinishedMatch.js';

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

function finishedFixture() {
  const base = createMatch(
    onePieceDeck,
    [ALICE.playerId, BOB.playerId],
    mulberry32(1),
  );
  const state = {
    ...base,
    result: { winner: ALICE.playerId, reason: 'allCards' as const },
  };
  const entry: MatchEntry = {
    matchId: 'm-persist',
    status: 'ended',
    players: [ALICE, BOB],
    createdAt: 0,
    state,
    rematchAccepted: [],
  };
  return { entry, state };
}

describe('persistFinishedMatch (story 3.1, AC2 failure path)', () => {
  it('passes the mapped record to insert', async () => {
    const { entry, state } = finishedFixture();
    const insert = vi.fn().mockResolvedValue(undefined);
    persistFinishedMatch(entry, state, insert);
    await vi.waitFor(() => expect(insert).toHaveBeenCalledOnce());
    expect(insert.mock.calls[0][0].winnerNickname).toBe('Alice');
  });

  it('logs with matchId and does not throw when insert rejects', async () => {
    const { entry, state } = finishedFixture();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn().mockRejectedValue(new Error('db down'));

    expect(() => persistFinishedMatch(entry, state, insert)).not.toThrow();
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(errorSpy.mock.calls[0].join(' ')).toContain('m-persist');
    errorSpy.mockRestore();
  });

  it('logs and skips (no insert) when the record cannot be built', async () => {
    const { entry } = finishedFixture();
    const unfinished = createMatch(
      onePieceDeck,
      [ALICE.playerId, BOB.playerId],
      mulberry32(2),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const insert = vi.fn();

    persistFinishedMatch(entry, unfinished, insert);
    expect(insert).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
