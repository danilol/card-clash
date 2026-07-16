import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentMatches, type RecentMatch } from './RecentMatches';

const MATCH: RecentMatch = {
  id: 1,
  playerOneNickname: 'Luffy',
  playerTwoNickname: 'Zoro',
  winnerNickname: 'Luffy',
  endReason: 'forfeit',
  roundsPlayed: 7,
  createdAt: '2026-07-16T12:00:00.000Z',
};

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RecentMatches (story 3.2)', () => {
  it('renders one line per match with the neutral reason label (AC1)', async () => {
    stubFetch(async () => new Response(JSON.stringify([MATCH])));
    render(<RecentMatches />);
    expect(await screen.findByText(/Luffy vs Zoro/)).toBeTruthy();
    // Neutral list label — NOT the result screen's "Opponent left — you win"
    expect(screen.getByText(/Forfeit/)).toBeTruthy();
    expect(screen.queryByText(/you win/)).toBeNull();
  });

  it('renders the friendly empty state on an empty database (AC3)', async () => {
    stubFetch(async () => new Response('[]'));
    render(<RecentMatches />);
    expect(await screen.findByText(/No matches yet/)).toBeTruthy();
  });

  it('shows a small visible line when the fetch fails (retro lesson)', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    render(<RecentMatches />);
    expect(
      await screen.findByText(/Could not load recent matches/),
    ).toBeTruthy();
  });

  it('treats a non-200 response as a failure, not data', async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ error: { code: 'DB_UNAVAILABLE' } }), {
          status: 500,
        }),
    );
    render(<RecentMatches />);
    expect(
      await screen.findByText(/Could not load recent matches/),
    ).toBeTruthy();
  });
});
