import { describe, expect, it } from 'vitest';
import {
  createMatch,
  onePieceDeck,
  mulberry32,
  projectFor,
} from '@card-clash/engine';
import { buildStartViews } from './startViews.js';
import type { Player } from '../store/matchStore.js';

const players: Player[] = [
  { playerId: 'p1', token: 'secret-1', nickname: 'Luffy', socketId: 'sock-1' },
  { playerId: 'p2', token: 'secret-2', nickname: 'Zoro', socketId: 'sock-2' },
];

// Seeded so the deal is reproducible.
const state = createMatch(onePieceDeck, ['p1', 'p2'], mulberry32(42));

describe('buildStartViews', () => {
  it('returns one view per player, addressed to that player’s socket', () => {
    const views = buildStartViews(state, players);
    expect(views.map((v) => v.socketId)).toEqual(['sock-1', 'sock-2']);
  });

  it('each view equals projectFor for that player', () => {
    const views = buildStartViews(state, players);
    expect(views[0].view).toEqual(projectFor(state, 'p1'));
    expect(views[1].view).toEqual(projectFor(state, 'p2'));
  });

  // AC4 / NFR2 — hidden information must not reach the wire.
  it('leaks no opponent cards, no buried stack order, and no Super Trump location', () => {
    for (const { view } of buildStartViews(state, players)) {
      const json = JSON.stringify(view);
      const me = view.you;
      const opponent = state.players.find((p) => p !== me)!;

      // No opponent card is present anywhere in the payload.
      for (const card of state.playerStacks[opponent]) {
        expect(json).not.toContain(card.id);
      }

      // Only your TOP card is visible — none of your buried cards leak (no deck/stack order).
      for (const card of state.playerStacks[me].slice(1)) {
        expect(json).not.toContain(card.id);
      }

      // The Super Trump's identity is never shipped — only the holder's boolean marker.
      expect(view).not.toHaveProperty('superTrumpCardId');
      expect(typeof view.yourTopCardIsSuperTrump).toBe('boolean');
    }
  });

  it('does not ship the secret player tokens', () => {
    const json = JSON.stringify(
      buildStartViews(state, players).map((v) => v.view),
    );
    expect(json).not.toContain('secret-1');
    expect(json).not.toContain('secret-2');
  });
});
