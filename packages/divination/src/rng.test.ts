import { describe, expect, it } from 'vitest';
import { seededRng, shuffle } from './rng.js';

describe('seededRng', () => {
  it('is deterministic per seed and stays in range', () => {
    const a = seededRng(42); const b = seededRng(42);
    const xs = Array.from({ length: 500 }, () => a(10));
    expect(xs).toEqual(Array.from({ length: 500 }, () => b(10)));
    expect(xs.every((x) => Number.isInteger(x) && x >= 0 && x < 10)).toBe(true);
    expect(new Set(xs).size).toBe(10);
  });
  it('differs across seeds', () => {
    const a = seededRng(1); const b = seededRng(2);
    expect(Array.from({ length: 20 }, () => a(1000))).not.toEqual(Array.from({ length: 20 }, () => b(1000)));
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const out = shuffle(input, seededRng(7));
    expect([...out].sort()).toEqual([...input]);
    expect(out).not.toEqual([...input]);
  });
});
