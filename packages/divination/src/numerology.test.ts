import { describe, expect, it } from 'vitest';
import { castNumerology, expressionNumber, lifePathNumber, reduceNumber } from './numerology.js';
import { NUMBER_MEANINGS } from './data/numbers.js';

describe('reduceNumber', () => {
  it.each([[7, 7], [13, 4], [29, 11], [38, 11], [22, 22], [33, 33], [1990, 1], [99, 9]])('%i → %i', (n, r) => {
    expect(reduceNumber(n)).toBe(r);
  });
});

describe('lifePathNumber', () => {
  it.each([
    ['1990-06-15', 4],   // 6 + 6 + 1 = 13 → 4
    ['1985-11-29', 9],   // 11 + 11 + 5 = 27 → 9
    ['1998-01-01', 11],  // 1 + 1 + 9 = 11 (master)
    ['2002-09-09', 22],  // 9 + 9 + 4 = 22 (master)
    ['2009-11-11', 33],  // 11 + 11 + 11 = 33 (master)
  ])('%s → %i', (d, n) => { expect(lifePathNumber(d)).toBe(n); });
});

describe('expressionNumber', () => {
  it('sums Pythagorean letter values', () => {
    expect(expressionNumber('Ada Lovelace')).toBe(9); // 6 + 30 = 36 → 9
  });
  it('strips diacritics and ignores punctuation', () => {
    expect(expressionNumber('Zoë')).toBe(expressionNumber('ZOE'));
    expect(expressionNumber("O'Brien-Smith")).toBe(expressionNumber('OBrienSmith'));
  });
  it('returns null without Latin letters', () => {
    expect(expressionNumber('李小龍')).toBeNull();
    expect(expressionNumber('   ')).toBeNull();
  });
});

describe('castNumerology', () => {
  it('includes expression only when a name is known', () => {
    expect(castNumerology({ birthDate: '1990-06-15', fullName: null, bloodType: null })).toEqual({ lifePath: 4, expression: null });
    expect(castNumerology({ birthDate: '1990-06-15', fullName: 'Ada Lovelace', bloodType: null })).toEqual({ lifePath: 4, expression: 9 });
  });
  it('has a meaning for every possible result', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]) expect(NUMBER_MEANINGS[n]?.title).toBeTruthy();
  });
});
