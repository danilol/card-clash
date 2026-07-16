import type { MatchState } from '@card-clash/engine';
import type { MatchEntry } from '../store/matchStore.js';
import { toMatchRecord, type MatchRecord } from './matchRecord.js';
import { insertMatch } from './matchRepository.js';

// Fire-and-forget FR27 write, called from BOTH match-ending sites (decision
// 2c). Never throws and never blocks the match:ended emit (AC2): a DB failure
// is one log line with the matchId.
export function persistFinishedMatch(
  entry: MatchEntry,
  finalState: MatchState,
  insert: (record: MatchRecord) => Promise<void> = insertMatch,
): void {
  const record = toMatchRecord(entry, finalState);
  if (!record) {
    console.error(
      `[db] match ${entry.matchId}: cannot build match record (no result or unknown winner) — skipping persist`,
    );
    return;
  }
  void insert(record).catch((err) => {
    console.error(`[db] match ${entry.matchId}: failed to persist result`, err);
  });
}
