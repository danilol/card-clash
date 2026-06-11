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

export { type Deck };
