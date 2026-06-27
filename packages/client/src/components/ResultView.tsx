import React from 'react';
import type { PlayerView } from '@card-clash/engine';

interface ResultViewProps {
  view: PlayerView;
  onRematch: () => void;
  rematchPending?: boolean;
}

export function ResultView({
  view,
  onRematch,
  rematchPending = false,
}: ResultViewProps): React.JSX.Element {
  return (
    <div>
      <h1>Result View</h1>
      <p>
        Winner:{' '}
        {view.result?.winner === view.you ? 'You won!' : 'Opponent won!'}
      </p>
      <p>Rounds played: {view.roundsPlayed}</p>
      <p>Reason: {view.result?.reason}</p>
      <button onClick={onRematch} disabled={rematchPending}>
        {rematchPending ? 'Waiting for opponent...' : 'Rematch'}
      </button>
    </div>
  );
}
