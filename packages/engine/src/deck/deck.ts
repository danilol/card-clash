import type { Card, StatDefinition } from "../types.js";


export type StatDirection = "high" | "low";

export interface Deck {
  stats: StatDefinition[];
  cards: Card[];
}

