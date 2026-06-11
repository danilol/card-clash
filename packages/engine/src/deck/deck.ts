import type { Card, StatDefinition } from '../types.js';

export interface Deck {
  readonly stats: readonly StatDefinition[];
  readonly cards: readonly Card[];
}
