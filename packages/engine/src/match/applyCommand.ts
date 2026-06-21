import type {
  MatchState,
  Command,
  CommandResult,
  PlayerId,
  RoundOutcome,
  Card,
  MatchResult,
} from '../types.js';
import { compareCards } from './round.js';

export function applyCommand(
  state: MatchState,
  command: Command,
): CommandResult {
  if (state.result !== null) {
    return {
      ok: false,
      error: {
        code: 'MATCH_OVER',
        message: 'Match is already over',
      },
    };
  }
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
  const chooserStack: Card[] = [...state.playerStacks[chooserId]];
  const opponentStack: Card[] = [...state.playerStacks[opponentId]];

  const chooserPlayedCard: Card = chooserStack.shift()!;
  const opponentPlayedCard: Card = opponentStack.shift()!;

  let newPot: Card[] = [...state.pot];

  const roundOutcome: RoundOutcome = compareCards(
    chooserId,
    chooserPlayedCard,
    opponentId,
    opponentPlayedCard,
    state.superTrumpCardId,
    def,
  );

  let newChooser: PlayerId = opponentId;
  let roundsPlayedCounter: number = state.roundsPlayed;
  let matchResult: MatchResult | null = null;

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

   if (conquestResultHappened(chooserStack, opponentStack)) {
    matchResult = {
      winner: conquestResultWinner(chooserStack, chooserId, opponentStack, opponentId),
      reason: 'allCards',
    };
   } else if (roundCapResultHappened(roundsPlayedCounter, chooserStack, opponentStack)) {
    matchResult = {
      winner: roundCapResultWinner(chooserStack, chooserId, opponentStack, opponentId),
      reason: 'roundCap',
    };
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
    result: matchResult,
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

function conquestResultHappened(chooserStack: Card[], opponentStack: Card[]) : boolean {
  if ((playerHasEmptyStack(chooserStack))||
      (playerHasEmptyStack(opponentStack))) {
    return true;
  }

  return false;
}

function conquestResultWinner(chooserStack: Card[], chooserId: PlayerId, opponentStack: Card[], opponentId: PlayerId) : PlayerId {
  if (playerHasEmptyStack(chooserStack)) {
    return opponentId;
  }

  if (playerHasEmptyStack(opponentStack)) {
    return chooserId;
  }

  throw new Error('Conquest result happened but no winner found');
}

function playerHasEmptyStack(stack: Card[]): boolean {
  return stack.length === 0;
}

function roundCapResultHappened(roundsPlayed: number, chooserStack: Card[], opponentStack: Card[]): boolean {
  return roundsPlayed >= 100 && chooserStack.length !== opponentStack.length;
}

function roundCapResultWinner(chooserStack: Card[], chooserId: PlayerId, opponentStack: Card[], opponentId: PlayerId) : PlayerId {

  if (chooserStack.length > opponentStack.length) {
    return chooserId;
  }

  if (opponentStack.length > chooserStack.length) {
    return opponentId;
  }

  throw new Error('Round cap result happened but no winner found');
}



