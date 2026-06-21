import type {
  MatchState,
  Command,
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

  const chooserPlayedCard = chooserStack.shift()!;
  const opponentPlayedCard = opponentStack.shift()!;

  let newPot = [...state.pot];

  const roundOutcome: RoundOutcome = compareCards(
    chooserId,
    chooserPlayedCard,
    opponentId,
    opponentPlayedCard,
    state.superTrumpCardId,
    def,
  );

  let newChooser: PlayerId = opponentId;
  let roundsPlayedCounter = state.roundsPlayed;

  if (roundOutcome.winner === null) {
    newChooser = chooserId; // if draw, chooser gets to go again

    if (chooserStack.length === 0) {
      addCardsToWinnerStack(
        opponentStack,
        chooserPlayedCard,
        opponentPlayedCard,
        newPot,
      );
      newPot = [];
    } else if (opponentStack.length === 0) {
      addCardsToWinnerStack(
        chooserStack,
        chooserPlayedCard,
        opponentPlayedCard,
        newPot,
      );
      newPot = [];
    } else {
      newPot = [...state.pot, chooserPlayedCard, opponentPlayedCard];
    }
  } else if (roundOutcome.winner === chooserId) {
    addCardsToWinnerStack(
      chooserStack,
      chooserPlayedCard,
      opponentPlayedCard,
      newPot,
    );
    newChooser = chooserId; // if chooser wins, they get to go again
    newPot = [];
    roundsPlayedCounter++;
  } else if (roundOutcome.winner === opponentId) {
    addCardsToWinnerStack(
      opponentStack,
      chooserPlayedCard,
      opponentPlayedCard,
      newPot,
    );
    newPot = [];
    roundsPlayedCounter++;
  }

  const newPlayerStacks: Record<PlayerId, readonly Card[]> = {
    [chooserId]: chooserStack,
    [opponentId]: opponentStack,
  };

  const newMatchState: MatchState = {
    players: state.players,
    playerStacks: newPlayerStacks,
    pot: newPot,
    superTrumpCardId: state.superTrumpCardId,
    chooser: newChooser,
    roundsPlayed: roundsPlayedCounter,
    statDefinitions: state.statDefinitions,
    lastRound: roundOutcome,
  };

  return { ok: true, state: newMatchState };
}

function addCardsToWinnerStack(
  winnerStack: Card[],
  chooserCard: Card,
  opponentCard: Card,
  pot: Card[],
): void {
  winnerStack.push(...pot, chooserCard, opponentCard);
}
