import type { EndReason, MatchState } from '@card-clash/engine';
import type { MatchEntry } from '../store/matchStore.js';

export type MatchRecord = {
  playerOneNickname: string;
  playerTwoNickname: string;
  winnerNickname: string;
  endReason: EndReason;
  roundsPlayed: number;
};

// Pure mapper: finished entry + final state → camelCase record (decision 2f).
// Returns null when the data is not a complete finished match (decision 2e) —
// the caller logs and skips the write.
export function toMatchRecord(
  entry: MatchEntry,
  finalState: MatchState,
): MatchRecord | null {
  const result = finalState.result;
  if (!result) return null;

  const [playerOne, playerTwo] = entry.players;
  const winner = entry.players.find((p) => p.playerId === result.winner);
  if (!playerOne || !playerTwo || !winner) return null;

  return {
    playerOneNickname: playerOne.nickname,
    playerTwoNickname: playerTwo.nickname,
    winnerNickname: winner.nickname,
    endReason: result.reason,
    roundsPlayed: finalState.roundsPlayed,
  };
}
