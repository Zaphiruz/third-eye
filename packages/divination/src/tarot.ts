import type { Rng, TarotData } from './types.js';
import { TAROT_CARDS, TAROT_POSITIONS } from './data/tarot.js';
import { shuffle } from './rng.js';

export function castTarot(rng: Rng): TarotData {
  const drawn = shuffle(TAROT_CARDS, rng).slice(0, TAROT_POSITIONS.length);
  return {
    cards: drawn.map((card, i) => ({ id: card.id, reversed: rng(2) === 1, position: TAROT_POSITIONS[i]! })),
  };
}
