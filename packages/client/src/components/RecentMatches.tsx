import { useEffect, useState } from 'react';
import type { EndReason } from '@card-clash/engine';
import { LIST_REASON_LABEL } from './reasonLabels';

// The JSON shape GET /api/matches/recent serves (mirrors the server's
// RecentMatch — the client package cannot import from the server package).
export type RecentMatch = {
  id: number;
  playerOneNickname: string;
  playerTwoNickname: string;
  winnerNickname: string;
  endReason: EndReason;
  roundsPlayed: number;
  createdAt: string; // ISO 8601
};

export function RecentMatches() {
  const [matches, setMatches] = useState<RecentMatch[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // StrictMode runs dev-mode effects twice — two GETs in dev are expected;
    // the ignore flag keeps the second (stale) result from racing the state.
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/matches/recent', {
          // A hung request must resolve into the error line, not a forever-
          // blank section.
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`recent matches: HTTP ${res.status}`);
        const data: unknown = await res.json();
        // A 200 with a non-array body must not reach .map — an uncaught
        // render throw would unmount the whole app, form included.
        if (!Array.isArray(data)) {
          throw new Error('recent matches: unexpected body');
        }
        if (!ignore) setMatches(data as RecentMatch[]);
      } catch {
        if (!ignore) setFailed(true);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section>
      <h2>Recent matches</h2>
      {!failed && matches === null && <p>Loading…</p>}
      {failed && <p>Could not load recent matches.</p>}
      {matches && matches.length === 0 && (
        <p>No matches yet — play the first one!</p>
      )}
      {matches && matches.length > 0 && (
        <ul>
          {matches.map((m) => (
            <li key={m.id}>
              {m.playerOneNickname} vs {m.playerTwoNickname} —{' '}
              {m.winnerNickname} won ·{' '}
              {LIST_REASON_LABEL[m.endReason] ?? m.endReason} ·{' '}
              {new Date(m.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
