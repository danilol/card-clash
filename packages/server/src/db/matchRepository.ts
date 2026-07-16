import { getPool } from './pool.js';
import {
  rowToRecentMatch,
  type MatchRecord,
  type MatchRow,
  type RecentMatch,
} from './matchRecord.js';

export const RECENT_MATCHES_LIMIT = 20;

// The ONLY file that contains SQL (architecture: data boundary).
// snake_case lives here and never leaks past this module.
export async function insertMatch(record: MatchRecord): Promise<void> {
  await getPool().query(
    `INSERT INTO matches
       (player_one_nickname, player_two_nickname, winner_nickname, end_reason, rounds_played)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      record.playerOneNickname,
      record.playerTwoNickname,
      record.winnerNickname,
      record.endReason,
      record.roundsPlayed,
    ],
  );
}

// FR28: the latest matches, newest first. The id tiebreak keeps rows with an
// identical timestamp in a stable order.
export async function findRecent(): Promise<RecentMatch[]> {
  const result = await getPool().query<MatchRow>(
    `SELECT id, player_one_nickname, player_two_nickname, winner_nickname,
            end_reason, rounds_played, created_at
       FROM matches
      ORDER BY created_at DESC, id DESC
      LIMIT $1`,
    [RECENT_MATCHES_LIMIT],
  );
  return result.rows.map(rowToRecentMatch);
}
