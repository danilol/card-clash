import React from 'react';
import type { PlayerView } from '@card-clash/engine';

interface ResultViewProps {
  view: PlayerView;
  onRematch: () => void;
  rematchPending?: boolean;
  error?: string | null;
}

const REASON_LABEL: Record<string, string> = {
  allCards: 'All cards captured',
  roundCap: 'Round cap reached',
  forfeit: 'Opponent left — you win',
};

export function ResultView({
  view,
  onRematch,
  rematchPending = false,
  error = null,
}: ResultViewProps): React.JSX.Element {
  const reason = view.result?.reason;
  // The match entry is evicted on forfeit and on opponent-left, so a rematch
  // can no longer succeed — hide the button instead of offering a dead action.
  const opponentGone = reason === 'forfeit' || error !== null;
  return (
    <div>
      <h1>Result View</h1>
      <p>
        Winner:{' '}
        {view.result?.winner === view.you ? 'You won!' : 'Opponent won!'}
      </p>
      <p>Rounds played: {view.roundsPlayed}</p>
      <p>Reason: {reason ? (REASON_LABEL[reason] ?? reason) : ''}</p>
      {error && <p role="alert">{error}</p>}
      {!opponentGone && (
        <button onClick={onRematch} disabled={rematchPending}>
          {rematchPending ? 'Waiting for opponent...' : 'Rematch'}
        </button>
      )}
    </div>
  );
}
