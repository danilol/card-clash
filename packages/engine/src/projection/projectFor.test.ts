import { describe, expect, it } from 'vitest';

import { onePieceDeck } from '../deck/onePieceDeck.js';
import type { Card, MatchState, PlayerId, RoundOutcome } from '../types.js';
import { projectFor } from './projectFor.js';

const ALICE = 'alice';
const BOB = 'bob';

function cardById(id: string): Card {
  const card = onePieceDeck.cards.find((c) => c.id === id);
  if (!card) {
    throw new Error(`test setup: deck has no card '${id}'`);
  }
  return card;
}

const LUFFY = cardById('monkey-d-luffy');
const NAMI = cardById('nami');
const ZORO = cardById('roronoa-zoro');
const USOPP = cardById('usopp');
const CHOPPER = cardById('tony-tony-chopper');

// A sentinel id that matches no card, so no card reads as the Super Trump
// unless a test sets superTrumpCardId to a card it actually holds.
const NO_TRUMP_IN_PLAY = '__no-super-trump__';

function makeState(opts: {
  aliceStack: readonly Card[];
  bobStack: readonly Card[];
  pot?: readonly Card[];
  chooser?: PlayerId;
  superTrumpCardId?: string;
  lastRound?: RoundOutcome | null;
  result?: MatchState['result'];
}): MatchState {
  const {
    aliceStack,
    bobStack,
    pot = [],
    chooser = ALICE,
    superTrumpCardId = NO_TRUMP_IN_PLAY,
    lastRound = null,
    result = null,
  } = opts;
  return {
    players: [ALICE, BOB],
    playerStacks: { [ALICE]: aliceStack, [BOB]: bobStack },
    pot,
    superTrumpCardId,
    chooser,
    roundsPlayed: 0,
    statDefinitions: onePieceDeck.stats,
    lastRound,
    result,
  };
}

describe('projectFor — each player sees only their own view (AC 1)', () => {
  it('exposes own top card, both counts, pot count, chooser, and lastRound', () => {
    const lastRound: RoundOutcome = {
      stat: 'bounty',
      playedCards: { [ALICE]: [LUFFY], [BOB]: [NAMI] },
      winner: ALICE,
    };
    const state = makeState({
      aliceStack: [LUFFY, ZORO],
      bobStack: [NAMI, USOPP],
      pot: [CHOPPER],
      chooser: ALICE,
      lastRound,
    });

    const view = projectFor(state, ALICE);
    expect(view.you).toBe(ALICE);
    expect(view.yourTopCard).toEqual(LUFFY);
    expect(view.yourStackCount).toBe(2);
    expect(view.opponentStackCount).toBe(2);
    expect(view.potCount).toBe(1);
    expect(view.chooser).toBe(ALICE);
    expect(view.lastRound).toEqual(lastRound);
    expect(view.result).toBeNull();
  });

  it('gives each player their OWN top card', () => {
    const state = makeState({
      aliceStack: [LUFFY, ZORO],
      bobStack: [NAMI, USOPP],
    });

    expect(projectFor(state, ALICE).yourTopCard).toEqual(LUFFY);
    expect(projectFor(state, BOB).yourTopCard).toEqual(NAMI);
  });

  it('reports a null top card and zero count for an empty stack', () => {
    const state = makeState({ aliceStack: [], bobStack: [NAMI] });

    const view = projectFor(state, ALICE);
    expect(view.yourTopCard).toBeNull();
    expect(view.yourStackCount).toBe(0);
    expect(view.opponentStackCount).toBe(1);
    expect(view.yourTopCardIsSuperTrump).toBe(false);
  });
});

describe('projectFor — Super Trump marker is holder-only (FR19, AC 2)', () => {
  it('marks the trump when it is the viewer’s own top card', () => {
    const state = makeState({
      aliceStack: [LUFFY, ZORO],
      bobStack: [NAMI, USOPP],
      superTrumpCardId: LUFFY.id,
    });

    expect(projectFor(state, ALICE).yourTopCardIsSuperTrump).toBe(true);
    // The other player must NOT see that the trump is in play.
    expect(projectFor(state, BOB).yourTopCardIsSuperTrump).toBe(false);
  });

  it('never marks the trump when it sits on the opponent’s top card', () => {
    const state = makeState({
      aliceStack: [LUFFY, ZORO],
      bobStack: [NAMI, USOPP],
      superTrumpCardId: NAMI.id, // BOB's top card
    });

    expect(projectFor(state, BOB).yourTopCardIsSuperTrump).toBe(true);
    expect(projectFor(state, ALICE).yourTopCardIsSuperTrump).toBe(false);
  });
});

describe('projectFor — NFR2: forbidden data never reaches the wire (AC 3)', () => {
  it('serialized view hides the opponent’s cards and the Super Trump id', () => {
    // Trump sits on BOB's top card; BOB holds a known hand. ALICE must learn
    // none of it.
    const state = makeState({
      aliceStack: [LUFFY, CHOPPER],
      bobStack: [NAMI, USOPP, ZORO],
      superTrumpCardId: NAMI.id,
    });

    const json = JSON.stringify(projectFor(state, ALICE));

    // No Super Trump location (NAMI is the trump and BOB's top).
    expect(json).not.toContain(state.superTrumpCardId);
    // No opponent card identities.
    expect(json).not.toContain(NAMI.id);
    expect(json).not.toContain(USOPP.id);
    expect(json).not.toContain(ZORO.id);
    // ALICE's own deeper card is not exposed either — only the top card is.
    expect(json).not.toContain(CHOPPER.id);
    // ALICE's own top card IS allowed to appear.
    expect(json).toContain(LUFFY.id);
  });

  it('mirror: BOB’s view hides ALICE’s cards and the trump id', () => {
    const state = makeState({
      aliceStack: [LUFFY, CHOPPER, ZORO],
      bobStack: [NAMI, USOPP],
      superTrumpCardId: LUFFY.id, // ALICE's top
    });

    const json = JSON.stringify(projectFor(state, BOB));
    expect(json).not.toContain(state.superTrumpCardId);
    expect(json).not.toContain(LUFFY.id);
    expect(json).not.toContain(CHOPPER.id);
    expect(json).not.toContain(ZORO.id);
    expect(json).toContain(NAMI.id); // BOB's own top card
  });
});

describe('projectFor — unknown viewer', () => {
  it('throws for a viewer that is not in the match', () => {
    const state = makeState({ aliceStack: [LUFFY], bobStack: [NAMI] });
    expect(() => projectFor(state, 'nobody')).toThrow();
  });
});

describe('projectFor — purity', () => {
  it('does not mutate the input state', () => {
    const state = makeState({
      aliceStack: [LUFFY, ZORO],
      bobStack: [NAMI, USOPP],
      pot: [CHOPPER],
    });
    const snapshot = structuredClone(state);

    projectFor(state, ALICE);

    expect(state).toEqual(snapshot);
  });

  it('returns a plain value that survives JSON serialization', () => {
    const state = makeState({ aliceStack: [LUFFY], bobStack: [NAMI] });
    const view = projectFor(state, ALICE);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});
