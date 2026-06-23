import { useState } from 'react';
import type { AckPayload, MatchJoinCommand } from '@card-clash/engine';
import { socket } from '../socket';
import type { Dispatch } from 'react';
import type { Action } from '../state/reducer';

export function HomeScreen({ dispatch }: { dispatch: Dispatch<Action> }) {
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchLink, setMatchLink] = useState<string | null>(null);

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
        throw new Error(errorData.error || 'Failed to create match!');
      }

      const data: MatchJoinCommand = await httpResponse.json();
      const link = `${window.location.origin}/?match=${data.matchId}`;
      setMatchLink(link);

      const ack = await new Promise<AckPayload>((resolve) => {
        socket.emit(
          'match:join',
          { matchId: data.matchId, nickname },
          (res: AckPayload) => {
            resolve(res);
          },
        );
      });

      if (ack.ok === false) {
        throw new Error(ack.error.message);
      }

      dispatch({
        type: 'match/joined',
        matchId: data.matchId,
        link: link,
        playerId: ack.playerId,
        token: ack.token,
      });

      console.log('Match joined with response: ', ack);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="home-screen">
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

      {matchLink && (
        <div>
          <p>Match link</p>
          <p>{matchLink}</p>
        </div>
      )}
    </div>
  );
}
