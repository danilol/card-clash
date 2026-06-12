import type { Deck } from '../deck/deck.js';
import type { MatchState, PlayerId, Card } from '../types.js';
import { type Rng } from '../rng.js';

export function createMatch(
  deck: Deck,
  players: readonly PlayerId[],
  rng: Rng,
): MatchState {
  const player1: PlayerId = players[0];
  const player2: PlayerId = players[1];

  const matchDeckCards = fisherYatesShuffle([...deck.cards], rng);
  const superTrumpCard = pickTrumpCard(matchDeckCards, rng);
  const firstToChoose = players[randomIndex(players, rng)];

  const cardsPlayer1: Card[] = matchDeckCards.slice(0, 16);
  const cardsPlayer2: Card[] = matchDeckCards.slice(16);

  const playerStacks: Record<PlayerId, readonly Card[]> = {
    [player1]: cardsPlayer1,
    [player2]: cardsPlayer2,
  };

  const match: MatchState = {
    players: [player1, player2],
    playerStacks: playerStacks,
    pot: [],
    superTrumpCardId: superTrumpCard.id,
    chooser: firstToChoose,
    roundsPlayed: 0,
  };

  return match;
}

function fisherYatesShuffle(arr: Card[], rng: Rng): Card[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickTrumpCard(cards: Card[], rng: Rng) {
  const cardsWithoutCounterCard = cards.filter((card) => !card.counterCard);
  return cardsWithoutCounterCard[randomIndex(cardsWithoutCounterCard, rng)];
}

function randomIndex(arr: readonly unknown[], rng: Rng) {
  return Math.floor(rng.next() * arr.length);
}
