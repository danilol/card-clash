import type { Deck } from './deck/deck.js';

export { type Deck };

export type StatKey =
  | 'bounty'
  | 'age'
  | 'haki'
  | 'loyalty'
  | 'devilFruitMastery'
  | 'fearFactor'
  | 'speed'
  | 'battleIQ';

export interface StatDefinition {
  key: StatKey;
  label: string;
  direction: Direction;
}

export type Direction = 'high' | 'low';

export interface Card {
  id: string;
  name: string;
  stats: Record<StatKey, number>;
  counterCard?: true;
}

export type PlayerId = string;

// index 0 is the top of the stack
export type PlayerStacks = Readonly<Record<PlayerId, readonly Card[]>>;

// the main state of the match
export type MatchState = {
  readonly players: readonly PlayerId[];
  readonly playerStacks: PlayerStacks;
  readonly pot: readonly Card[];
  readonly superTrumpCardId: string;
  readonly chooser: PlayerId;
  readonly roundsPlayed: number;
  readonly statDefinitions: readonly StatDefinition[];
  readonly lastRound: RoundOutcome | null; // first round is null, every subsequent round has a value
  readonly result: MatchResult | null;
};

export type SelectStatCommand = {
  type: 'selectStat';
  stat: StatKey;
  playerId: PlayerId;
};

export type Command = SelectStatCommand;

export type CommandResult =
  | { ok: true; state: MatchState }
  | { ok: false; error: { code: CommandErrorCode; message: string } };

export type CommandErrorCode = 'MATCH_OVER' | 'NOT_CHOOSER' | 'INVALID_STAT';

export type RoundOutcome = {
  stat: StatKey;
  playedCards: PlayerStacks;
  winner: PlayerId | null;
};

export type ComparisonResult = 'chooser' | 'opponent' | 'tie';

export type MatchResult = {
  winner: PlayerId;
  reason: EndReason;
};

export type EndReason = 'allCards' | 'roundCap';

export type PlayerView = {
  readonly you: PlayerId;
  readonly yourTopCard: Card | null;
  readonly yourStackCount: number;
  readonly opponentStackCount: number;
  readonly potCount: number;
  readonly chooser: PlayerId;
  readonly yourTopCardIsSuperTrump: boolean;
  readonly lastRound: RoundOutcome | null;
  readonly result: MatchResult | null;
  readonly statDefinitions: readonly StatDefinition[];
  readonly roundsPlayed: number;
};
