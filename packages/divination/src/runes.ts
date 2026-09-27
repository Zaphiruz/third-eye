import type { Rng, RuneData } from './types.js';
import { RUNES } from './data/runes.js';

export function castRune(rng: Rng): RuneData {
  const rune = RUNES[rng(RUNES.length)]!;
  return { id: rune.id, reversed: rune.reversedMeaning !== null && rng(2) === 1 };
}
