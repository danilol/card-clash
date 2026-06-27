import type { MatchState, PlayerId, PlayerView } from '../types.js';

export function projectFor(state: MatchState, viewerId: PlayerId): PlayerView {
  if (!state.players.includes(viewerId)) {
    throw new Error(`Unknown viewer: ${viewerId}`);
  }

  const opponentId: PlayerId = state.players.find((p) => p !== viewerId)!;
  const yourStack = state.playerStacks[viewerId];
  const opponentStack = state.playerStacks[opponentId];

  return {
    you: viewerId,
    yourTopCard: yourStack.length > 0 ? yourStack[0] : null,
    yourStackCount: yourStack.length,
    opponentStackCount: opponentStack.length,
    potCount: state.pot.length,
    chooser: state.chooser,
    yourTopCardIsSuperTrump: state.superTrumpCardId === yourStack[0]?.id,
    lastRound: state.lastRound,
    result: state.result,
    statDefinitions: state.statDefinitions,
    roundsPlayed: state.roundsPlayed,
  };
}
