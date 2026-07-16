import React, { useState, type Dispatch } from 'react';
import type { Action } from '../state/reducer';
import type { AckPayload } from '@card-clash/engine';
import { socket } from '../socket';

export function JoinScreen({
  dispatch,
}: {
  dispatch: Dispatch<Action>;
}): React.JSX.Element {
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchId: string =
    new URLSearchParams(window.location.search).get('match') ?? '';

  if (!matchId) {
    return <div>Invalid match link</div>;
  }

  const handleJoinMatch = async () => {
    if (!nickname.trim()) {
      setError('Nickname cannot be empty!!');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const ack = await new Promise<AckPayload>((resolve, reject) => {
        socket
          .timeout(5000)
          .emit('match:join', { matchId, nickname }, (err, res: AckPayload) => {
            if (err)
              reject(new Error('Server did not respond — please try again.'));
            else resolve(res);
          });
      });

      if (ack.ok === false) {
        throw new Error(ack.error.message);
      }

      dispatch({
        type: 'match/joined',
        matchId,
        link: window.location.href,
        nickname,
        playerId: ack.playerId,
        token: ack.token,
      });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Something went wrong',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={(e) => e.preventDefault()}>
        {error && (
          <p className="error-message" style={{ color: 'red' }}>
            {error}
          </p>
        )}
        <h1>Join Screen</h1>
        <input
          type="text"
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          disabled={isLoading}
          placeholder="Enter your match nickname"
        />
        <button onClick={handleJoinMatch} disabled={isLoading}>
          {isLoading ? 'Joining...' : 'Join'}
        </button>
      </form>
    </div>
  );
}
