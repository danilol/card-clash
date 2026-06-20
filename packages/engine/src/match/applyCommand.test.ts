import { describe, expect, it } from 'vitest';

import { onePieceDeck } from '../deck/onePieceDeck.js';
import type {
  Card,
  MatchState,
  PlayerId,
  SelectStatCommand,
  StatKey,
} from '../types.js';
import { applyCommand } from './applyCommand.js';

// Player ids are deliberately not 'player1'/'player2': applyCommand must work
// with whatever ids the state carries, never invented ones.
const ALICE = 'alice';
const BOB = 'bob';

function cardById(id: string): Card {
  const card = onePieceDeck.cards.find((c) => c.id === id);
  if (!card) {
    throw new Error(`test setup: deck has no card '${id}'`);
  }
  return card;
}

// Hand-build a minimal MatchState with known top cards. Index 0 is the top of
// the stack (the 1.3 convention), so the first card in each array is played.
function makeState(opts: {
  chooserStack: readonly Card[];
  opponentStack: readonly Card[];
  chooser?: PlayerId;
  roundsPlayed?: number;
}): MatchState {
  const {
    chooserStack,
    opponentStack,
    chooser = ALICE,
    roundsPlayed = 0,
  } = opts;
  const opponent = chooser === ALICE ? BOB : ALICE;
  return {
    players: [ALICE, BOB],
    playerStacks: {
      [chooser]: chooserStack,
      [opponent]: opponentStack,
    },
    pot: [],
    superTrumpCardId: 'monkey-d-luffy', // unused by round resolution in 1.4
    chooser,
    roundsPlayed,
    statDefinitions: onePieceDeck.stats,
    lastRound: null,
  };
}

function selectStat(playerId: PlayerId, stat: StatKey): SelectStatCommand {
  return { type: 'selectStat', playerId, stat };
}

// Cards with clear, unambiguous stat gaps used across the comparison tests.
const LUFFY = cardById('monkey-d-luffy'); // bounty 3_000_000_000, age 19
const NAMI = cardById('nami'); // bounty 366_000_000, age 20
const ZORO = cardById('roronoa-zoro'); // filler
const USOPP = cardById('usopp'); // filler
const CHOPPER = cardById('tony-tony-chopper'); // age 17 (youngest used here)
const BROOK = cardById('brook'); // age 90 (oldest used here)
const LAW = cardById('trafalgar-d-water-law'); // bounty 3_000_000_000 (ties Luffy/Kid)
const KID = cardById('eustass-kid'); // bounty 3_000_000_000

describe('applyCommand — compare, higher wins (FR13, AC 1)', () => {
  it('chooser wins when their stat is higher (bounty: high wins)', () => {
    const state = makeState({ chooserStack: [LUFFY], opponentStack: [NAMI] });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return; // narrow for TypeScript
    expect(result.state.lastRound?.winner).toBe(ALICE);
  });

  it('opponent wins when their stat is higher (mirror case)', () => {
    const state = makeState({ chooserStack: [NAMI], opponentStack: [LUFFY] });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(BOB);
  });
});

describe('applyCommand — Age is low-wins (FR13, AC 1)', () => {
  it('chooser wins when their age is LOWER', () => {
    const state = makeState({
      chooserStack: [CHOPPER],
      opponentStack: [BROOK],
    });
    const result = applyCommand(state, selectStat(ALICE, 'age'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(ALICE);
  });

  it('opponent wins when their age is LOWER (mirror case)', () => {
    const state = makeState({
      chooserStack: [BROOK],
      opponentStack: [CHOPPER],
    });
    const result = applyCommand(state, selectStat(ALICE, 'age'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(BOB);
  });
});

describe('applyCommand — transfer to winner (FR14, AC 1)', () => {
  it('winner takes both cards at the bottom, in order [own, opponent]', () => {
    // ALICE plays LUFFY (bounty 3e9) vs BOB's NAMI (366e6) -> ALICE wins.
    const state = makeState({
      chooserStack: [LUFFY, ZORO],
      opponentStack: [NAMI, USOPP],
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Winner's stack: rest of own stack, then own played card, then opponent's.
    expect(result.state.playerStacks[ALICE]).toEqual([ZORO, LUFFY, NAMI]);
    // The two new cards sit at the very bottom, own first.
    expect(result.state.playerStacks[ALICE].slice(-2)).toEqual([LUFFY, NAMI]);
    // Loser's stack: lost the top card only.
    expect(result.state.playerStacks[BOB]).toEqual([USOPP]);
  });

  it('conserves the full card multiset (nothing lost or duplicated)', () => {
    const state = makeState({
      chooserStack: [LUFFY, ZORO],
      opponentStack: [NAMI, USOPP],
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const before = [LUFFY, ZORO, NAMI, USOPP].map((c) => c.id).sort();
    const after = [
      ...result.state.playerStacks[ALICE],
      ...result.state.playerStacks[BOB],
    ]
      .map((c) => c.id)
      .sort();
    expect(after).toEqual(before);
  });
});

describe('applyCommand — pass the turn (FR15, AC 1)', () => {
  it('winner becomes the next chooser (chooser won)', () => {
    const state = makeState({ chooserStack: [LUFFY], opponentStack: [NAMI] });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.chooser).toBe(ALICE);
  });

  it('winner becomes the next chooser (opponent won)', () => {
    const state = makeState({ chooserStack: [NAMI], opponentStack: [LUFFY] });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.chooser).toBe(BOB);
  });

  it('increments roundsPlayed by exactly 1', () => {
    const state = makeState({
      chooserStack: [LUFFY],
      opponentStack: [NAMI],
      roundsPlayed: 5,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.roundsPlayed).toBe(6);
  });
});

describe('applyCommand — records the round outcome (AC 3)', () => {
  it('lastRound carries the stat, both played cards, and the winner', () => {
    const state = makeState({
      chooserStack: [LUFFY, ZORO],
      opponentStack: [NAMI, USOPP],
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { lastRound } = result.state;
    expect(lastRound).not.toBeNull();
    expect(lastRound?.stat).toBe('bounty');
    expect(lastRound?.winner).toBe(ALICE);
    // "who played what" — keyed by the real player ids, the played top cards.
    expect(lastRound?.playedCards[ALICE]).toEqual([LUFFY]);
    expect(lastRound?.playedCards[BOB]).toEqual([NAMI]);
  });
});

describe('applyCommand — legality (AC 2: no throw, stable code, unchanged state)', () => {
  it('rejects a command from the non-chooser with NOT_CHOOSER', () => {
    const state = makeState({ chooserStack: [LUFFY], opponentStack: [NAMI] });
    const snapshot = structuredClone(state);

    const result = applyCommand(state, selectStat(BOB, 'bounty'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_CHOOSER');
    expect(state).toEqual(snapshot); // original state untouched
  });

  it('rejects an unknown stat with INVALID_STAT', () => {
    const state = makeState({ chooserStack: [LUFFY], opponentStack: [NAMI] });
    const snapshot = structuredClone(state);

    // Cast simulates a runtime-bad stat value reaching the engine.
    const result = applyCommand(
      state,
      selectStat(ALICE, 'charisma' as StatKey),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_STAT');
    expect(state).toEqual(snapshot);
  });
});

describe('applyCommand — purity (functional core)', () => {
  it('does not mutate the input state on a successful command', () => {
    const state = makeState({
      chooserStack: [LUFFY, ZORO],
      opponentStack: [NAMI, USOPP],
    });
    const snapshot = structuredClone(state);

    applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(state).toEqual(snapshot);
  });

  it('returns a plain value that survives JSON serialization', () => {
    const state = makeState({ chooserStack: [LUFFY], opponentStack: [NAMI] });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const roundTripped = JSON.parse(JSON.stringify(result.state));
    expect(roundTripped).toEqual(result.state);
  });
});

describe('applyCommand — ties are deferred to story 1.6', () => {
  it('throws the loud placeholder when the chosen stat ties', () => {
    // LAW and KID both have bounty 3_000_000_000 -> a tie.
    const state = makeState({ chooserStack: [LAW], opponentStack: [KID] });
    expect(() => applyCommand(state, selectStat(ALICE, 'bounty'))).toThrow(
      /1\.6/,
    );
  });
});
