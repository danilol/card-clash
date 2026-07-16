import { getPool } from './pool.js';
import type { MatchRecord } from './matchRecord.js';

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
