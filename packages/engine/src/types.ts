import type { Deck } from './deck/deck.js';

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
  direction: 'high' | 'low';
}

export interface Card {
  id: string;
  name: string;
  stats: Record<StatKey, number>;
  counterCard?: true;
}

export type PlayerId = string;

// index 0 is the top of the stack
export type PlayerStacks = Readonly<Record<PlayerId, readonly Card[]>>;

export type MatchState = {
  readonly players: readonly PlayerId[];
  readonly playerStacks: PlayerStacks;
  readonly pot: readonly Card[];
  readonly superTrumpCardId: string;
  readonly chooser: PlayerId;
  readonly roundsPlayed: number;
};

export { type Deck };
