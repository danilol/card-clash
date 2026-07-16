import type { MatchEntry } from '../store/matchStore.js';

// The pure DECISION for a socket disconnect (story 2.6, decision 6d).
// The socket handler just executes it: decide → emit → evict.
export type DisconnectResolution =
  | { kind: 'forfeit'; winnerId: string; remainingSocketId: string }
  | { kind: 'abandon' }
  | { kind: 'opponentLeft'; remainingSocketId: string }
  | { kind: 'none' };

export function resolveDisconnect(
  entry: MatchEntry,
  socketId: string,
): DisconnectResolution {
  const leaver = entry.players.find((p) => p.socketId === socketId);
  if (!leaver) {
    return { kind: 'none' };
  }

  const remaining = entry.players.find((p) => p.playerId !== leaver.playerId);

  switch (entry.status) {
    case 'waiting':
      return { kind: 'abandon' };
    case 'playing':
      if (!remaining) return { kind: 'abandon' };
      return {
        kind: 'forfeit',
        winnerId: remaining.playerId,
        remainingSocketId: remaining.socketId,
      };
    case 'ended':
      if (!remaining) return { kind: 'abandon' };
      return { kind: 'opponentLeft', remainingSocketId: remaining.socketId };
  }
}
