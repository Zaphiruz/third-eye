import { describe, expect, it } from 'vitest';
import { castChinese, lunarYearOf } from './chinese.js';
import { LUNAR_NEW_YEAR, LUNAR_NEW_YEAR_FIRST_YEAR } from './data/lunar-new-year.js';
import { CHINESE_ANIMALS, CHINESE_ELEMENTS } from './data/chinese.js';

const p = (birthDate: string) => ({ birthDate, fullName: null, bloodType: null });

describe('lunar new year table', () => {
  it('covers 1900–2100 with January/February dates', () => {
    expect(LUNAR_NEW_YEAR_FIRST_YEAR).toBe(1900);
    expect(LUNAR_NEW_YEAR).toHaveLength(201);
    expect(LUNAR_NEW_YEAR.every((d) => /^0[12]-\d{2}$/.test(d))).toBe(true);
  });
  it.each([[1900, '01-31'], [1984, '02-02'], [2000, '02-05'], [2024, '02-10'], [2025, '01-29'], [2026, '02-17']])(
    '%i starts on %s', (year, md) => { expect(LUNAR_NEW_YEAR[year - 1900]).toBe(md); },
  );
});

describe('lunarYearOf', () => {
  it('uses the previous year before Lunar New Year', () => {
    expect(lunarYearOf('2024-02-09')).toBe(2023);
    expect(lunarYearOf('2024-02-10')).toBe(2024);
    expect(lunarYearOf('1900-01-15')).toBe(1899);
  });
  it('rejects dates outside the table', () => {
    expect(() => lunarYearOf('2101-06-01')).toThrow(RangeError);
  });
});

describe('castChinese', () => {
  it.each([
    ['1984-02-01', { animal: 'pig', element: 'water', polarity: 'yin', lunarYear: 1983 }],
    ['1984-02-02', { animal: 'rat', element: 'wood', polarity: 'yang', lunarYear: 1984 }],
    ['1990-06-15', { animal: 'horse', element: 'metal', polarity: 'yang', lunarYear: 1990 }],
    ['2024-02-09', { animal: 'rabbit', element: 'water', polarity: 'yin', lunarYear: 2023 }],
    ['2024-02-10', { animal: 'dragon', element: 'wood', polarity: 'yang', lunarYear: 2024 }],
    ['1976-08-01', { animal: 'dragon', element: 'fire', polarity: 'yang', lunarYear: 1976 }],
  ])('%s', (date, expected) => {
    expect(castChinese(p(date))).toEqual(expected);
  });

  it('has 12 animals and 5 elements', () => {
    expect(CHINESE_ANIMALS.map((a) => a.id)).toEqual(
      ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'],
    );
    expect(CHINESE_ELEMENTS.map((e) => e.id)).toEqual(['wood', 'fire', 'earth', 'metal', 'water']);
  });
});
