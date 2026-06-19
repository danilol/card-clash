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
    playerStacks,
    pot: [],
    superTrumpCardId: superTrumpCard.id,
    chooser: firstToChoose,
    roundsPlayed: 0,
    statDefinitions: deck.stats,
    lastRound: null,
  };

  return match;
}

/**
 * Shuffles a list of cards into a random order using the Fisher-Yates algorithm.
 *
 * The idea is simple: walk the list from the last card to the first. At each
 * step, pick a random card from the part not yet shuffled (positions 0..i) and
 * swap it into the current position `i`. After one full pass, every card has
 * had a fair chance to land in any position.
 *
 * Fisher-Yates is the correct way to shuffle. A common beginner mistake is to
 * sort with a random comparator (e.g. arr.sort(() => rng.next() - 0.5)) — that
 * looks random but is actually biased, so some orders show up more than others.
 *
 * The randomness comes from `rng`, not Math.random directly. Because our `rng`
 * is seeded (see mulberry32), the same seed produces the same shuffle every
 * time — which keeps matches reproducible and testable.
 *
 * It does not change the input: it copies `arr` first and returns the new,
 * shuffled array.
 *
 * @param arr - the cards to shuffle (left unchanged)
 * @param rng - the random source; a seeded rng gives a repeatable shuffle
 *
 * @param arr - the cards to shuffle (left unchanged)
 * @param rng - the random source; a seeded rng gives a repeatable shuffle
 * @returns a new array with the same cards in random order
 */
function fisherYatesShuffle(arr: Card[], rng: Rng): Card[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Picks a random card from the deck that is not a counter card.
 *
 * @param cards - the cards to pick from
 * @param rng - the random source
 * @returns a random card that is not a counter card
 */
function pickTrumpCard(cards: Card[], rng: Rng) {
  const cardsWithoutCounterCard = cards.filter((card) => !card.counterCard);
  return cardsWithoutCounterCard[randomIndex(cardsWithoutCounterCard, rng)];
}

/**
 * Picks a random index from the array.
 *
 * @param arr - the array to pick from
 * @param rng - the random source
 * @returns a random index
 */
function randomIndex(arr: readonly unknown[], rng: Rng) {
  return Math.floor(rng.next() * arr.length);
}
