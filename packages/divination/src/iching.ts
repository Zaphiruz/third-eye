import type { IChingData, Rng } from './types.js';
import { hexagramNumber } from './data/hexagrams.js';

type Line = 6 | 7 | 8 | 9;
const coin = (rng: Rng) => (rng(2) === 1 ? 3 : 2);

export function castIChing(rng: Rng): IChingData {
  const lines = Array.from({ length: 6 }, () => (coin(rng) + coin(rng) + coin(rng)) as Line);
  const isYang = (l: Line) => (l === 7 || l === 9 ? 1 : 0);
  const changingLines = lines.flatMap((l, i) => (l === 6 || l === 9 ? [i + 1] : []));
  const primary = hexagramNumber(lines.map(isYang));
  const relating = changingLines.length
    ? hexagramNumber(lines.map((l) => (l === 6 ? 1 : l === 9 ? 0 : isYang(l))))
    : null;
  return { lines, primary, changingLines, relating };
}
