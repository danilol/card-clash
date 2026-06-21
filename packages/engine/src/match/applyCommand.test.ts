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

// A sentinel id that matches no card. With this as the Super Trump, rounds
// resolve purely on stats — so a test must opt into trump behaviour by passing
// superTrumpCardId equal to a card it actually deals.
const NO_TRUMP_IN_PLAY = '__no-super-trump__';

// Hand-build a minimal MatchState with known top cards. Index 0 is the top of
// the stack (the 1.3 convention), so the first card in each array is played.
function makeState(opts: {
  chooserStack: readonly Card[];
  opponentStack: readonly Card[];
  chooser?: PlayerId;
  roundsPlayed?: number;
  superTrumpCardId?: string;
  pot?: readonly Card[];
}): MatchState {
  const {
    chooserStack,
    opponentStack,
    chooser = ALICE,
    roundsPlayed = 0,
    superTrumpCardId = NO_TRUMP_IN_PLAY,
    pot = [],
  } = opts;
  const opponent = chooser === ALICE ? BOB : ALICE;
  return {
    players: [ALICE, BOB],
    playerStacks: {
      [chooser]: chooserStack,
      [opponent]: opponentStack,
    },
    pot,
    superTrumpCardId,
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
const KUZAN = cardById('kuzan-aokiji'); // bounty 3_000_000_000 (fourth tie card)
const BUGGY = cardById('buggy-the-clown'); // the fixed Counter card (counterCard: true)

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

describe('applyCommand — a tie feeds the pot (FR20, AC 1)', () => {
  it('moves both played cards to the pot and keeps the same chooser', () => {
    // LAW and KID both have bounty 3_000_000_000 -> a tie. Both players keep a
    // next card, so this is an ordinary tie (not an elimination).
    const state = makeState({
      chooserStack: [LAW, ZORO],
      opponentStack: [KID, NAMI],
      roundsPlayed: 7,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Both top cards moved to the pot, chooser card first (the chosen order).
    expect(result.state.pot).toEqual([LAW, KID]);
    // Each stack lost only its top card.
    expect(result.state.playerStacks[ALICE]).toEqual([ZORO]);
    expect(result.state.playerStacks[BOB]).toEqual([NAMI]);
    // The same chooser keeps the turn (FR21).
    expect(result.state.chooser).toBe(ALICE);
    // A tie is recorded as winner = null and does not count as a decided round.
    expect(result.state.lastRound?.winner).toBeNull();
    expect(result.state.roundsPlayed).toBe(7);
  });

  it('does not throw on a tie and does not mutate the input state', () => {
    const state = makeState({
      chooserStack: [LAW, ZORO],
      opponentStack: [KID, NAMI],
    });
    const snapshot = structuredClone(state);

    expect(() =>
      applyCommand(state, selectStat(ALICE, 'bounty')),
    ).not.toThrow();
    expect(state).toEqual(snapshot);
  });
});

describe('applyCommand — the winner sweeps the pot (FR21, AC 2)', () => {
  it('a decided stat round takes the played cards then the whole pot', () => {
    // Pot already holds two cards from earlier ties. LUFFY (3e9) beats NAMI
    // (366e6) on bounty -> chooser wins and sweeps the pot.
    const state = makeState({
      chooserStack: [LUFFY],
      opponentStack: [NAMI],
      pot: [CHOPPER, BROOK],
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Winner's bottom: the pot (in order), then chooser's card, then opponent's.
    expect(result.state.playerStacks[ALICE]).toEqual([
      CHOPPER,
      BROOK,
      LUFFY,
      NAMI,
    ]);
    expect(result.state.playerStacks[BOB]).toEqual([]);
    expect(result.state.pot).toEqual([]);

    // Multiset conserved.
    const before = [LUFFY, NAMI, CHOPPER, BROOK].map((c) => c.id).sort();
    const after = [
      ...result.state.playerStacks[ALICE],
      ...result.state.playerStacks[BOB],
      ...result.state.pot,
    ]
      .map((c) => c.id)
      .sort();
    expect(after).toEqual(before);
  });

  it('a Super Trump win also sweeps the pot', () => {
    // NAMI is the trump and would lose on bounty, but wins by trump and sweeps.
    const state = makeState({
      chooserStack: [NAMI],
      opponentStack: [LUFFY],
      superTrumpCardId: NAMI.id,
      pot: [CHOPPER, BROOK],
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.playerStacks[ALICE]).toEqual([
      CHOPPER,
      BROOK,
      NAMI,
      LUFFY,
    ]);
    expect(result.state.pot).toEqual([]);
  });
});

describe('applyCommand — ties chain (FR22, AC 3)', () => {
  it('two ties grow the pot, then a decided round sweeps all of it', () => {
    // Four bounty-3e9 cards force two ties; ZORO (1.111e9) then decides.
    let state = makeState({
      chooserStack: [LAW, LUFFY, ZORO],
      opponentStack: [KID, KUZAN, NAMI],
    });

    // Round 1: LAW vs KID -> tie.
    let result = applyCommand(state, selectStat(ALICE, 'bounty'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pot).toEqual([LAW, KID]);
    state = result.state;

    // Round 2: LUFFY vs KUZAN -> tie, pot keeps growing.
    result = applyCommand(state, selectStat(ALICE, 'bounty'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pot).toEqual([LAW, KID, LUFFY, KUZAN]);
    state = result.state;

    // Round 3: ZORO (1.111e9) beats NAMI (366e6) -> chooser sweeps everything.
    result = applyCommand(state, selectStat(ALICE, 'bounty'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pot).toEqual([]);
    // Pot (in accumulation order) first, then this round's chooser and opponent.
    expect(result.state.playerStacks[ALICE]).toEqual([
      LAW,
      KID,
      LUFFY,
      KUZAN,
      ZORO,
      NAMI,
    ]);
    expect(result.state.playerStacks[BOB]).toEqual([]);
  });
});

describe('applyCommand — a tie that cannot continue eliminates a player (FR23, AC 4)', () => {
  it('chooser runs out mid-tie: opponent collects all cards in play + pot', () => {
    // Chooser plays its last card into a tie -> cannot continue -> eliminated.
    const state = makeState({
      chooserStack: [LAW],
      opponentStack: [KID, NAMI],
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.playerStacks[ALICE]).toEqual([]); // eliminated
    // Opponent keeps their remaining stack, then pot (empty), chooser, opponent.
    expect(result.state.playerStacks[BOB]).toEqual([NAMI, LAW, KID]);
    expect(result.state.pot).toEqual([]);

    const after = [
      ...result.state.playerStacks[ALICE],
      ...result.state.playerStacks[BOB],
      ...result.state.pot,
    ]
      .map((c) => c.id)
      .sort();
    expect(after).toEqual([LAW, KID, NAMI].map((c) => c.id).sort());
  });

  it('opponent runs out mid-tie: chooser collects all cards in play + pot', () => {
    const state = makeState({
      chooserStack: [LAW, ZORO],
      opponentStack: [KID],
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.playerStacks[BOB]).toEqual([]); // eliminated
    expect(result.state.playerStacks[ALICE]).toEqual([ZORO, LAW, KID]);
    expect(result.state.pot).toEqual([]);
  });
});

describe('applyCommand — Super Trump auto-win (FR17, AC 1)', () => {
  it('trump holder wins even when their stat would lose (chooser holds trump)', () => {
    // NAMI (bounty 366e6) would lose to LUFFY (3e9) on bounty, but NAMI is the trump.
    const state = makeState({
      chooserStack: [NAMI],
      opponentStack: [LUFFY],
      superTrumpCardId: NAMI.id,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(ALICE);
    expect(result.state.chooser).toBe(ALICE);
  });

  it('trump holder wins even when the opponent would win on stat (opponent holds trump)', () => {
    // LUFFY (3e9) would beat NAMI (366e6) on bounty, but NAMI (opponent) is the trump.
    const state = makeState({
      chooserStack: [LUFFY],
      opponentStack: [NAMI],
      superTrumpCardId: NAMI.id,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(BOB);
    expect(result.state.chooser).toBe(BOB);
  });

  it('trump wins a would-be tie — no throw (chooser holds trump)', () => {
    // LAW and KID both have bounty 3e9 (a tie), but LAW is the trump -> chooser wins.
    const state = makeState({
      chooserStack: [LAW],
      opponentStack: [KID],
      superTrumpCardId: LAW.id,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(ALICE);
  });

  it('trump wins a would-be tie — no throw (opponent holds trump)', () => {
    const state = makeState({
      chooserStack: [LAW],
      opponentStack: [KID],
      superTrumpCardId: KID.id,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(BOB);
  });
});

describe('applyCommand — Buggy counters the Super Trump (FR18, AC 2)', () => {
  it('Buggy beats the trump when the chooser holds Buggy', () => {
    // Trump = LUFFY (opponent). Buggy (chooser) is the Counter -> chooser wins.
    const state = makeState({
      chooserStack: [BUGGY],
      opponentStack: [LUFFY],
      superTrumpCardId: LUFFY.id,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(ALICE);
    expect(result.state.chooser).toBe(ALICE);
  });

  it('Buggy beats the trump when the opponent holds Buggy', () => {
    // Trump = LUFFY (chooser). Buggy (opponent) is the Counter -> opponent wins.
    const state = makeState({
      chooserStack: [LUFFY],
      opponentStack: [BUGGY],
      superTrumpCardId: LUFFY.id,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(BOB);
    expect(result.state.chooser).toBe(BOB);
  });

  it('Buggy is an ordinary card when no Super Trump is in the round', () => {
    // No trump in play. Buggy (haki 10) loses to LUFFY (haki 92) on haki:
    // the Counter flag must do nothing without a trump present.
    const state = makeState({
      chooserStack: [BUGGY],
      opponentStack: [LUFFY],
    });
    const result = applyCommand(state, selectStat(ALICE, 'haki'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.lastRound?.winner).toBe(BOB);
  });
});

describe('applyCommand — Super Trump round still obeys the 1.4 contract', () => {
  it('transfers both cards to the trump winner and passes the turn (FR14, FR15)', () => {
    // Chooser holds the trump (NAMI) and would lose on bounty, but wins by trump.
    const state = makeState({
      chooserStack: [NAMI, ZORO],
      opponentStack: [LUFFY, USOPP],
      superTrumpCardId: NAMI.id,
      roundsPlayed: 3,
    });
    const result = applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Winner (ALICE): rest of own stack, then own played card, then opponent's.
    expect(result.state.playerStacks[ALICE]).toEqual([ZORO, NAMI, LUFFY]);
    expect(result.state.playerStacks[ALICE].slice(-2)).toEqual([NAMI, LUFFY]);
    // Loser (BOB) lost only the top card.
    expect(result.state.playerStacks[BOB]).toEqual([USOPP]);
    expect(result.state.chooser).toBe(ALICE);
    expect(result.state.roundsPlayed).toBe(4);

    // Multiset conserved.
    const before = [NAMI, ZORO, LUFFY, USOPP].map((c) => c.id).sort();
    const after = [
      ...result.state.playerStacks[ALICE],
      ...result.state.playerStacks[BOB],
    ]
      .map((c) => c.id)
      .sort();
    expect(after).toEqual(before);
  });

  it('legality is still checked before resolution, even with a trump on top', () => {
    // Trump on top, but the command comes from the non-chooser -> NOT_CHOOSER,
    // and the state is untouched (no throw, no resolution).
    const state = makeState({
      chooserStack: [LUFFY],
      opponentStack: [NAMI],
      superTrumpCardId: LUFFY.id,
    });
    const snapshot = structuredClone(state);

    const result = applyCommand(state, selectStat(BOB, 'bounty'));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_CHOOSER');
    expect(state).toEqual(snapshot);
  });

  it('does not mutate the input state on a trump win', () => {
    const state = makeState({
      chooserStack: [NAMI, ZORO],
      opponentStack: [LUFFY, USOPP],
      superTrumpCardId: NAMI.id,
    });
    const snapshot = structuredClone(state);

    applyCommand(state, selectStat(ALICE, 'bounty'));

    expect(state).toEqual(snapshot);
  });
});
