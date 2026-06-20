import type {
  MatchState,
  Command,
  SelectStatCommand,
  CommandResult,
  PlayerId,
  RoundOutcome,
  Card,
} from '../types.js';
import { compareCards } from './round.js';

export function applyCommand(
  state: MatchState,
  command: Command,
): CommandResult {
  if (command.playerId !== state.chooser) {
    return {
      ok: false,
      error: {
        code: 'NOT_CHOOSER',
        message: 'Not the chooser',
      },
    };
  }

  const def = state.statDefinitions.find((d) => d.key === command.stat);
  if (def === undefined) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STAT',
        message: 'Invalid stat',
      },
    };
  }

  const chooserId: PlayerId = command.playerId;
  const opponentId: PlayerId = state.players.find((p) => p !== chooserId)!;

  // create shallow copies to avoid mutating the original arrays
  const chooserStack = [...state.playerStacks[chooserId]];
  const opponentStack = [...state.playerStacks[opponentId]];

  const chooserPlayingCard = chooserStack.shift()!;
  const opponentPlayingCard = opponentStack.shift()!;

  const roundOutcome: RoundOutcome = compareCards(
    chooserId,
    chooserPlayingCard,
    opponentId,
    opponentPlayingCard,
    state.superTrumpCardId,
    def,
  );

  if (roundOutcome.winner === null) {
    throw new Error('tie resolution lands in story 1.6');
  }

  let newChooser: PlayerId = opponentId;

  if (roundOutcome.winner === chooserId) {
    chooserStack.push(chooserPlayingCard);
    chooserStack.push(opponentPlayingCard);
    newChooser = chooserId;
  }

  if (roundOutcome.winner === opponentId) {
    opponentStack.push(chooserPlayingCard);
    opponentStack.push(opponentPlayingCard);
  }


  const newPlayerStacks: Record<PlayerId, readonly Card[]> = {
    [chooserId]: chooserStack,
    [opponentId]: opponentStack,
  };

  const newMatchState: MatchState = {
    players: state.players,
    playerStacks: newPlayerStacks,
    pot: state.pot,
    superTrumpCardId: state.superTrumpCardId,
    chooser: newChooser,
    roundsPlayed: state.roundsPlayed + 1,
    statDefinitions: state.statDefinitions,
    lastRound: roundOutcome,
  };

  return { ok: true, state: newMatchState };
}
