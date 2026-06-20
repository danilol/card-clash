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
  stat: StatDefinition,
): RoundOutcome {
  const statKey = stat.key;

  const chooserStat = chooserCard.stats[statKey];
  const opponentStat = opponentCard.stats[statKey];
  const direction = stat.direction;

  const comparisonResult = compareStats(chooserStat, opponentStat, direction);

  const winner: PlayerId | null =
    comparisonResult === 'chooser'
      ? chooserId
      : comparisonResult === 'opponent'
        ? opponentId
        : null;

  const playedCards = {
    [chooserId]: [chooserCard],
    [opponentId]: [opponentCard],
  };

  return {
    stat: stat.key,
    playedCards,
    winner,
  };
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
