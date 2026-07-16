import { useState } from 'react';
import type { AckPayload } from '@card-clash/engine';
import { socket } from '../socket';
import type { Dispatch } from 'react';
import type { Action, Match } from '../state/reducer';
import { RecentMatches } from './RecentMatches';

export function HomeScreen({ dispatch }: { dispatch: Dispatch<Action> }) {
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateMatch = async () => {
    if (!nickname.trim()) {
      setError('Nickname cannot be empty!!');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const httpResponse: Response = await fetch(
        'http://localhost:3000/api/matches',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ nickname }),
        },
      );

      if (!httpResponse.ok) {
        const errorData = await httpResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to create match!');
      }

      const data: { matchId: string } = await httpResponse.json();

      const ack = await new Promise<AckPayload>((resolve, reject) => {
        socket
          .timeout(5000)
          .emit(
            'match:join',
            { matchId: data.matchId, nickname },
            (err, res: AckPayload) => {
              if (err)
                reject(new Error('Server did not respond — please try again.'));
              else resolve(res);
            },
          );
      });

      if (ack.ok === false) {
        throw new Error(ack.error.message);
      }

      const link = `${window.location.origin}/?match=${data.matchId}`;

      const joinMatchPayload: Match = {
        matchId: data.matchId,
        link: link,
        nickname,
        playerId: ack.playerId,
        token: ack.token,
      };
      dispatch({ type: 'match/joined', ...joinMatchPayload });
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
    <>
      <form onSubmit={(e) => e.preventDefault()}>
        <div>
          <div>
            <h1>Card Clash</h1>
            <p>Create a match and get a shareable link</p>
          </div>

          <div>
            <label htmlFor="nickname">Nickname</label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your match nickname"
            />
          </div>

          {error && (
            <p className="error-message" style={{ color: 'red' }}>
              {error}
            </p>
          )}

          <div>
            <button onClick={handleCreateMatch} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </form>
      <RecentMatches />
    </>
  );
}
