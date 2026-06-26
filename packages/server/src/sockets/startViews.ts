import type { MatchState, PlayerView } from '@card-clash/engine';
import { projectFor } from '@card-clash/engine';
import type { Player } from '../store/matchStore.js';

export function buildStartViews(
  state: MatchState,
  players: Player[],
): Array<{ socketId: string; view: PlayerView }> {
  return players.map((p) => ({
    socketId: p.socketId,
    view: projectFor(state, p.playerId),
  }));
}
