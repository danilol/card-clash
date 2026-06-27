import { describe, expect, it } from 'vitest';
import {
  createMatch,
  applyCommand,
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

  // NFR2 still holds AFTER a round is played: the reveal exposes the cards that
  // were PLAYED (allowed), but the per-player views are still pure projections —
  // no raw state, and the opponent's next (hidden) top card never leaks.
  describe('after a round', () => {
    const result = applyCommand(state, {
      type: 'selectStat',
      playerId: state.chooser,
      stat: 'haki',
    });
    if (!result.ok) throw new Error('test setup: selectStat should be legal');
    const next = result.state;

    it('a round was recorded (lastRound populated)', () => {
      for (const { view } of buildStartViews(next, players)) {
        expect(view.lastRound).not.toBeNull();
      }
    });

    it('views remain pure projections (only door) with no raw state fields', () => {
      for (const { view } of buildStartViews(next, players)) {
        expect(view).toEqual(projectFor(next, view.you));
        expect(view).not.toHaveProperty('playerStacks');
        expect(view).not.toHaveProperty('pot');
        expect(view).not.toHaveProperty('superTrumpCardId');
      }
    });

    it('the opponent’s next (hidden) top card still does not leak', () => {
      for (const { view } of buildStartViews(next, players)) {
        const opponent = next.players.find((p) => p !== view.you)!;
        const opponentTop = next.playerStacks[opponent][0];
        if (opponentTop) {
          expect(JSON.stringify(view)).not.toContain(opponentTop.id);
        }
      }
    });
  });
});
