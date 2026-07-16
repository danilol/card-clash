import { describe, expect, it } from 'vitest';

import { onePieceDeck } from '../deck/onePieceDeck.js';
import { mulberry32 } from '../rng.js';
import { createMatch } from './setup.js';
import { forfeitMatch } from './forfeit.js';

const ALICE = 'alice';
const BOB = 'bob';
const PLAYERS = [ALICE, BOB] as const;

describe('forfeitMatch (story 2.6, AC 2)', () => {
  it('sets result to { winner, reason: forfeit }', () => {
    const state = createMatch(onePieceDeck, PLAYERS, mulberry32(1));
    const forfeited = forfeitMatch(state, BOB);
    expect(forfeited.result).toEqual({ winner: BOB, reason: 'forfeit' });
  });

  it('leaves the rest of the state intact', () => {
    const state = createMatch(onePieceDeck, PLAYERS, mulberry32(2));
    const forfeited = forfeitMatch(state, ALICE);
    expect(forfeited.players).toBe(state.players);
    expect(forfeited.playerStacks).toBe(state.playerStacks);
    expect(forfeited.pot).toBe(state.pot);
    expect(forfeited.superTrumpCardId).toBe(state.superTrumpCardId);
    expect(forfeited.chooser).toBe(state.chooser);
    expect(forfeited.roundsPlayed).toBe(state.roundsPlayed);
    expect(forfeited.statDefinitions).toBe(state.statDefinitions);
    expect(forfeited.lastRound).toBe(state.lastRound);
  });

  it('does not mutate the input state', () => {
    const state = createMatch(onePieceDeck, PLAYERS, mulberry32(3));
    const forfeited = forfeitMatch(state, BOB);
    expect(forfeited).not.toBe(state);
    expect(state.result).toBeNull();
  });
});
