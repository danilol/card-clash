import type {
  Card,
  StatDefinition,
  Direction,
  PlayerId,
  RoundOutcome,
  ComparisonResult,
} from '../types.js';

export function compareCards(
  chooserId: PlayerId,
  chooserCard: Card,
  opponentId: PlayerId,
  opponentCard: Card,
  superTrumpCardId: string,
  stat: StatDefinition,
): RoundOutcome {
  const statKey = stat.key;

  const chooserStat = chooserCard.stats[statKey];
  const opponentStat = opponentCard.stats[statKey];
  const direction = stat.direction;

  const playedCards = {
    [chooserId]: [chooserCard],
    [opponentId]: [opponentCard],
  };

  if (trumpPlayedThisRound(chooserCard, opponentCard, superTrumpCardId)) {
    const superTrumpWinner = superTrumpResolution(
      chooserCard,
      opponentCard,
      superTrumpCardId,
    );

    return {
      stat: stat.key,
      playedCards,
      winner: resolveWinnerId(superTrumpWinner, chooserId, opponentId),
    };
  } else {
    const comparisonResult = compareStats(chooserStat, opponentStat, direction);
    const winner = resolveWinnerId(comparisonResult, chooserId, opponentId);

    return {
      stat: stat.key,
      playedCards,
      winner,
    };
  }
}

function compareStats(
  chooserStat: number,
  opponentStat: number,
  direction: Direction,
): ComparisonResult {
  const difference = chooserStat - opponentStat;

  if (difference === 0) return 'tie';

  const winner = (direction === 'high' ? difference > 0 : difference < 0)
    ? 'chooser'
    : 'opponent';

  return winner;
}

function isSuperTrump(card: Card, superTrumpCardId: string): boolean {
  return card.id === superTrumpCardId;
}

function superTrumpResolution(
  chooserCard: Card,
  opponentCard: Card,
  superTrumpCardId: string,
): string | null {
  let resolution: string | null = null;
  if (isSuperTrump(chooserCard, superTrumpCardId)) {
    resolution = opponentCard.counterCard ? 'opponent' : 'chooser';
  }

  if (isSuperTrump(opponentCard, superTrumpCardId)) {
    resolution = chooserCard.counterCard ? 'chooser' : 'opponent';
  }

  return resolution;
}

function resolveWinnerId(
  comparisonWinner: string | null,
  chooserId: PlayerId,
  opponentId: PlayerId,
): PlayerId | null {
  const winnerId =
    comparisonWinner === 'chooser'
      ? chooserId
      : comparisonWinner === 'opponent'
        ? opponentId
        : null;

  return winnerId;
}

function trumpPlayedThisRound(
  chooserCard: Card,
  opponentCard: Card,
  superTrumpCardId: string,
): boolean {
  return (
    chooserCard.id === superTrumpCardId || opponentCard.id === superTrumpCardId
  );
}
