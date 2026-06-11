import { describe, expect, it } from 'vitest';

import type { StatDefinition, StatKey } from '../types.js';
import { onePieceDeck } from './onePieceDeck.js';

// PRD Appendix A stat columns (story 1.2, AC 1/2): keys, display labels, win direction
const STAT_DEFINITIONS: StatDefinition[] = [
  { key: 'bounty', label: 'Bounty', direction: 'high' },
  { key: 'age', label: 'Age', direction: 'low' },
  { key: 'haki', label: 'Haki', direction: 'high' },
  { key: 'loyalty', label: 'Loyalty/Honor', direction: 'high' },
  { key: 'devilFruitMastery', label: 'Devil Fruit Mastery', direction: 'high' },
  { key: 'fearFactor', label: 'Fear Factor', direction: 'high' },
  { key: 'speed', label: 'Speed/Agility', direction: 'high' },
  { key: 'battleIQ', label: 'Battle IQ', direction: 'high' },
];

const STAT_KEYS: StatKey[] = STAT_DEFINITIONS.map((stat) => stat.key);

// The 0-100 scale stats; bounty and age have no fixed ceiling
const SCALE_STAT_KEYS: StatKey[] = [
  'haki',
  'loyalty',
  'devilFruitMastery',
  'fearFactor',
  'speed',
  'battleIQ',
];

// PRD Appendix A row order #1-#32 (story 1.2, Task 3)
const CARD_IDS_PRD_ORDER = [
  'monkey-d-luffy',
  'roronoa-zoro',
  'nami',
  'usopp',
  'vinsmoke-sanji',
  'tony-tony-chopper',
  'nico-robin',
  'franky',
  'brook',
  'jinbe',
  'shanks',
  'marshall-d-teach',
  'buggy-the-clown',
  'dracule-mihawk',
  'sir-crocodile',
  'gol-d-roger',
  'edward-newgate',
  'kaido',
  'charlotte-linlin',
  'trafalgar-d-water-law',
  'eustass-kid',
  'boa-hancock',
  'donquixote-doflamingo',
  'portgas-d-ace',
  'monkey-d-garp',
  'sakazuki-akainu',
  'kuzan-aokiji',
  'borsalino-kizaru',
  'bartholomew-kuma',
  'monkey-d-dragon',
  'sabo',
  'mr-2-bon-clay',
];

// PRD Appendix A spot-check rows (story 1.2, AC 1)
const SPOT_CHECKS: Array<{
  id: string;
  name: string;
  stats: Record<StatKey, number>;
}> = [
  {
    id: 'monkey-d-luffy',
    name: 'Monkey D. Luffy',
    stats: {
      bounty: 3_000_000_000,
      age: 19,
      haki: 92,
      loyalty: 98,
      devilFruitMastery: 97,
      fearFactor: 88,
      speed: 94,
      battleIQ: 40,
    },
  },
  {
    id: 'tony-tony-chopper',
    name: 'Tony Tony Chopper',
    stats: {
      bounty: 1_000,
      age: 17,
      haki: 0,
      loyalty: 98,
      devilFruitMastery: 85,
      fearFactor: 5,
      speed: 70,
      battleIQ: 80,
    },
  },
  {
    id: 'monkey-d-dragon',
    name: 'Monkey D. Dragon',
    stats: {
      bounty: 5_000_000_000,
      age: 55,
      haki: 95,
      loyalty: 90,
      devilFruitMastery: 90,
      fearFactor: 95,
      speed: 90,
      battleIQ: 96,
    },
  },
  {
    id: 'buggy-the-clown',
    name: 'Buggy the Clown',
    stats: {
      bounty: 3_189_000_000,
      age: 39,
      haki: 10,
      loyalty: 15,
      devilFruitMastery: 60,
      fearFactor: 85,
      speed: 70,
      battleIQ: 50,
    },
  },
];

describe('onePieceDeck stats', () => {
  it('defines exactly the 8 PRD stats with display labels, in PRD order', () => {
    expect(onePieceDeck.stats).toEqual(STAT_DEFINITIONS);
  });

  it('flags age as low-wins and every other stat as high-wins (FR13)', () => {
    for (const stat of onePieceDeck.stats) {
      expect(stat.direction).toBe(stat.key === 'age' ? 'low' : 'high');
    }
  });
});

describe('onePieceDeck cards', () => {
  it('has exactly 32 cards', () => {
    expect(onePieceDeck.cards).toHaveLength(32);
  });

  it('has unique ids', () => {
    const ids = onePieceDeck.cards.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique names', () => {
    const names = onePieceDeck.cards.map((card) => card.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps PRD Appendix A order #1-#32', () => {
    expect(onePieceDeck.cards.map((card) => card.id)).toEqual(
      CARD_IDS_PRD_ORDER,
    );
  });

  it.each(onePieceDeck.cards)(
    '$name has exactly the 8 stat keys with finite non-negative integer values',
    (card) => {
      expect(Object.keys(card.stats).sort()).toEqual([...STAT_KEYS].sort());
      for (const key of STAT_KEYS) {
        const value = card.stats[key];
        expect(
          Number.isInteger(value),
          `${key} must be an integer, got ${value}`,
        ).toBe(true);
        expect(value, `${key} must be non-negative`).toBeGreaterThanOrEqual(0);
      }
      for (const key of SCALE_STAT_KEYS) {
        expect(
          card.stats[key],
          `${key} is a 0-100 scale stat`,
        ).toBeLessThanOrEqual(100);
      }
    },
  );

  it('has exactly one counter card, and it is Buggy the Clown (FR18)', () => {
    const counterCards = onePieceDeck.cards.filter((card) => card.counterCard);
    expect(counterCards.map((card) => card.id)).toEqual(['buggy-the-clown']);
  });

  it.each(SPOT_CHECKS)(
    'matches PRD Appendix A for $name',
    ({ id, name, stats }) => {
      const card = onePieceDeck.cards.find((candidate) => candidate.id === id);
      expect(card, `card with id "${id}" must exist`).toBeDefined();
      expect(card?.name).toBe(name);
      expect(card?.stats).toEqual(stats);
    },
  );
});
