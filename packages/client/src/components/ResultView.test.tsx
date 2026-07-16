import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlayerView } from '@card-clash/engine';
import { ResultView } from './ResultView';

function makeView(reason: 'allCards' | 'roundCap' | 'forfeit'): PlayerView {
  return {
    you: 'p-1',
    yourTopCard: null,
    yourStackCount: 32,
    opponentStackCount: 0,
    potCount: 0,
    chooser: 'p-1',
    yourTopCardIsSuperTrump: false,
    lastRound: null,
    result: { winner: 'p-1', reason },
    statDefinitions: [],
    roundsPlayed: 5,
  };
}

describe('ResultView (deferred render tests, landed in 3.1)', () => {
  it('shows the forfeit label and hides Rematch on a forfeit win', () => {
    render(<ResultView view={makeView('forfeit')} onRematch={() => {}} />);
    expect(screen.getByText(/Opponent left — you win/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rematch/ })).toBeNull();
  });

  it('shows the Rematch button on a normal ending', () => {
    render(<ResultView view={makeView('allCards')} onRematch={() => {}} />);
    expect(screen.getByText(/All cards captured/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Rematch/ })).toBeTruthy();
  });

  it('renders the error line and hides Rematch when an error is shown', () => {
    render(
      <ResultView
        view={makeView('roundCap')}
        onRematch={() => {}}
        error="Opponent left the match"
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Opponent left the match',
    );
    expect(screen.queryByRole('button', { name: /Rematch/ })).toBeNull();
  });
});
