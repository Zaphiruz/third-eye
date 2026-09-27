import { describe, expect, it } from 'vitest';
import type { Rng } from './types.js';
import { castIChing } from './iching.js';
import { HEXAGRAMS, getHexagram, hexagramLines, hexagramNumber } from './data/hexagrams.js';
import { seededRng } from './rng.js';

const scripted = (values: number[]): Rng => { let i = 0; return () => values[i++]!; };

describe('hexagram lookup', () => {
  it('maps all 64 line patterns to 64 distinct numbers and back', () => {
    const seen = new Set<number>();
    for (let v = 0; v < 64; v++) {
      const bits = Array.from({ length: 6 }, (_, i) => ((v >> i) & 1) as 0 | 1);
      const n = hexagramNumber(bits);
      seen.add(n);
      expect(hexagramLines(n)).toEqual(bits);
    }
    expect(seen.size).toBe(64);
  });
  it.each([
    [[1, 1, 1, 1, 1, 1], 1], [[0, 0, 0, 0, 0, 0], 2],
    [[1, 0, 0, 0, 1, 0], 3],   // Water over Thunder
    [[1, 1, 1, 0, 0, 0], 11],  // Earth over Heaven
    [[0, 0, 0, 1, 1, 1], 12],  // Heaven over Earth
    [[0, 0, 0, 0, 0, 1], 23],  // Mountain over Earth
    [[1, 0, 1, 0, 1, 0], 63],  // Water over Fire
    [[0, 1, 0, 1, 0, 1], 64],  // Fire over Water
  ] as [(0 | 1)[], number][])('%j → %i', (bits, n) => { expect(hexagramNumber(bits)).toBe(n); });
  it('has names and keywords for all 64', () => {
    expect(HEXAGRAMS).toHaveLength(64);
    HEXAGRAMS.forEach((h, i) => { expect(h.number).toBe(i + 1); expect(h.keywords.length).toBe(3); });
    expect(getHexagram(1).name).toBe('The Creative');
    expect(getHexagram(64).name).toBe('Before Completion');
  });
});

describe('castIChing', () => {
  it('all heads → six old yang lines: The Creative changing to The Receptive', () => {
    expect(castIChing(scripted(Array(18).fill(1)))).toEqual({
      lines: [9, 9, 9, 9, 9, 9], primary: 1, changingLines: [1, 2, 3, 4, 5, 6], relating: 2,
    });
  });
  it('two heads one tail on every line → young yin, no relating hexagram', () => {
    expect(castIChing(scripted(Array(6).fill([1, 1, 0]).flat()))).toEqual({
      lines: [8, 8, 8, 8, 8, 8], primary: 2, changingLines: [], relating: null,
    });
  });
  it('produces valid, deterministic casts', () => {
    for (let s = 0; s < 100; s++) {
      const d = castIChing(seededRng(s));
      expect(d).toEqual(castIChing(seededRng(s)));
      expect(d.lines.every((l) => l >= 6 && l <= 9)).toBe(true);
      expect(d.changingLines).toEqual(d.lines.flatMap((l, i) => (l === 6 || l === 9 ? [i + 1] : [])));
      expect(d.relating === null).toBe(d.changingLines.length === 0);
    }
  });
});
