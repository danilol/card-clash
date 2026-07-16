import type { EndReason, MatchState } from '@card-clash/engine';
import type { MatchEntry } from '../store/matchStore.js';

export type MatchRecord = {
  playerOneNickname: string;
  playerTwoNickname: string;
  winnerNickname: string;
  endReason: EndReason;
  roundsPlayed: number;
};

// One SELECTed row of the matches table, as pg returns it (story 3.2).
// Note: BIGINT (id) arrives as a string — pg's precision-safe default.
export type MatchRow = {
  id: string;
  player_one_nickname: string;
  player_two_nickname: string;
  winner_nickname: string;
  end_reason: EndReason;
  rounds_played: number;
  created_at: Date;
};

// The JSON shape GET /api/matches/recent serves (story 3.2, decision 1b).
export type RecentMatch = {
  id: number;
  playerOneNickname: string;
  playerTwoNickname: string;
  winnerNickname: string;
  endReason: EndReason;
  roundsPlayed: number;
  createdAt: string; // ISO 8601
};

// Pure row mapper: snake_case column names and pg types stop here.
export function rowToRecentMatch(row: MatchRow): RecentMatch {
  return {
    id: Number(row.id),
    playerOneNickname: row.player_one_nickname,
    playerTwoNickname: row.player_two_nickname,
    winnerNickname: row.winner_nickname,
    endReason: row.end_reason,
    roundsPlayed: row.rounds_played,
    createdAt: row.created_at.toISOString(),
  };
}

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
