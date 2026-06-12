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
export type PlayerStack = Record<PlayerId, readonly Card[]>;

export type MatchState = {
  players: readonly PlayerId[];
  playerStacks: PlayerStack;
  pot: readonly Card[];
  superTrumpCardId: string;
  chooser: PlayerId;
  roundsPlayed: number;

  // TODO: Add other fields as needed
};

export { type Deck };
