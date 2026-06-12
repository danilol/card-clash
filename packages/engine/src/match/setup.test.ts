import { describe, expect, it } from 'vitest';

import { onePieceDeck } from '../deck/onePieceDeck.js';
import { mulberry32 } from '../rng.js';
import { createMatch } from './setup.js';

// Tests use names that are NOT 'player1'/'player2' on purpose:
// createMatch must use the players it receives, not invent its own.
const ALICE = 'alice';
const BOB = 'bob';
const PLAYERS = [ALICE, BOB] as const;

const counterCard = onePieceDeck.cards.find((card) => card.counterCard);
if (!counterCard) {
  throw new Error('test setup: deck has no counter card');
}

describe('createMatch — deal (FR7, AC 1)', () => {
  it('deals 16 cards to each player', () => {
    const state = createMatch(onePieceDeck, PLAYERS, mulberry32(1));
    expect(state.playerStacks[ALICE]).toHaveLength(16);
    expect(state.playerStacks[BOB]).toHaveLength(16);
  });

  it('loses no card and duplicates no card', () => {
    const state = createMatch(onePieceDeck, PLAYERS, mulberry32(2));
    const dealtIds = [
      ...state.playerStacks[ALICE].map((card) => card.id),
      ...state.playerStacks[BOB].map((card) => card.id),
    ].sort();
    const deckIds = onePieceDeck.cards.map((card) => card.id).sort();
    expect(dealtIds).toEqual(deckIds);
  });
});

describe('createMatch — determinism (AC 1)', () => {
  it('same seed reproduces the exact same setup', () => {
    const a = createMatch(onePieceDeck, PLAYERS, mulberry32(42));
    const b = createMatch(onePieceDeck, PLAYERS, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('different seeds produce different stack orders', () => {
    const a = createMatch(onePieceDeck, PLAYERS, mulberry32(1));
    const b = createMatch(onePieceDeck, PLAYERS, mulberry32(2));
    const orderA = state2CardIds(a);
    const orderB = state2CardIds(b);
    expect(orderA).not.toEqual(orderB);
  });
});

describe('createMatch — Super Trump (FR9, AC 2)', () => {
  it('never selects the counter card, across 200 seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = createMatch(onePieceDeck, PLAYERS, mulberry32(seed));
      expect(state.superTrumpCardId).not.toBe(counterCard.id);
    }
  });

  it('always selects a card that exists in the deck', () => {
    const deckIds = new Set(onePieceDeck.cards.map((card) => card.id));
    for (let seed = 0; seed < 200; seed++) {
      const state = createMatch(onePieceDeck, PLAYERS, mulberry32(seed));
      expect(deckIds.has(state.superTrumpCardId)).toBe(true);
    }
  });
});

describe('createMatch — first chooser (FR10, AC 3)', () => {
  it('chooser is always one of the given players', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = createMatch(onePieceDeck, PLAYERS, mulberry32(seed));
      expect(PLAYERS).toContain(state.chooser);
    }
  });

  it('both players get chosen across many seeds', () => {
    const chosen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const state = createMatch(onePieceDeck, PLAYERS, mulberry32(seed));
      chosen.add(state.chooser);
    }
    expect(chosen).toEqual(new Set(PLAYERS));
  });
});

describe('createMatch — purity and plain value (AC 4)', () => {
  it('does not mutate the deck', () => {
    const idsBefore = onePieceDeck.cards.map((card) => card.id);
    createMatch(onePieceDeck, PLAYERS, mulberry32(5));
    const idsAfter = onePieceDeck.cards.map((card) => card.id);
    expect(idsAfter).toEqual(idsBefore);
  });

  it('uses the players it receives, not hardcoded ids', () => {
    const state = createMatch(
      onePieceDeck,
      ['zoro-fan', 'nami-fan'],
      mulberry32(3),
    );
    expect(state.players).toEqual(['zoro-fan', 'nami-fan']);
    expect(state.playerStacks['zoro-fan']).toHaveLength(16);
    expect(state.playerStacks['nami-fan']).toHaveLength(16);
  });

  it('starts with an empty pot and zero rounds played', () => {
    const state = createMatch(onePieceDeck, PLAYERS, mulberry32(4));
    expect(state.pot).toEqual([]);
    expect(state.roundsPlayed).toBe(0);
  });

  it('two matches with independently-seeded rngs do not interfere', () => {
    // Interleaved with a noise call in between: each match must depend
    // only on its own rng, not on any shared state.
    const aloneA = createMatch(onePieceDeck, PLAYERS, mulberry32(11));
    const aloneB = createMatch(onePieceDeck, PLAYERS, mulberry32(22));

    const interleavedA = createMatch(onePieceDeck, PLAYERS, mulberry32(11));
    createMatch(onePieceDeck, PLAYERS, mulberry32(99));
    const interleavedB = createMatch(onePieceDeck, PLAYERS, mulberry32(22));

    expect(interleavedA).toEqual(aloneA);
    expect(interleavedB).toEqual(aloneB);
  });

  it('is a plain value that survives JSON serialization', () => {
    const state = createMatch(onePieceDeck, PLAYERS, mulberry32(6));
    const roundTripped = JSON.parse(JSON.stringify(state));
    expect(roundTripped).toEqual(state);
  });
});

// Full card order across both stacks, used to compare two setups.
function state2CardIds(state: ReturnType<typeof createMatch>): string[] {
  return [
    ...state.playerStacks[ALICE].map((card) => card.id),
    ...state.playerStacks[BOB].map((card) => card.id),
  ];
}
