import type { MatchState, PlayerId } from '../types.js';

// A forfeit is a server-driven ending (a player left), not a game-rule ending,
// so no round logic runs here — we only stamp the result. Pure: returns a copy.
export function forfeitMatch(
  state: MatchState,
  winnerId: PlayerId,
): MatchState {
  return {
    ...state,
    result: { winner: winnerId, reason: 'forfeit' },
  };
}
