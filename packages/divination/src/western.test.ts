import { describe, expect, it } from 'vitest';
import { castWestern, sunSign } from './western.js';
import { ZODIAC_SIGNS } from './data/zodiac.js';

describe('sunSign', () => {
  it.each([
    ['1990-03-20', 'pisces'], ['1990-03-21', 'aries'],
    ['1990-04-19', 'aries'], ['1990-04-20', 'taurus'],
    ['1990-06-15', 'gemini'], ['1990-07-23', 'leo'],
    ['1990-12-21', 'sagittarius'], ['1990-12-22', 'capricorn'],
    ['1991-01-19', 'capricorn'], ['1991-01-20', 'aquarius'],
    ['1992-02-29', 'pisces'], ['1990-10-23', 'scorpio'],
  ])('%s → %s', (date, sign) => {
    expect(sunSign(date)).toBe(sign);
  });

  it('has twelve signs with unique ids and glyphs', () => {
    expect(ZODIAC_SIGNS).toHaveLength(12);
    expect(new Set(ZODIAC_SIGNS.map((s) => s.id)).size).toBe(12);
    expect(new Set(ZODIAC_SIGNS.map((s) => s.glyph)).size).toBe(12);
  });

  it('castWestern wraps the sign', () => {
    expect(castWestern({ birthDate: '1990-06-15', fullName: null, bloodType: null })).toEqual({ sign: 'gemini' });
  });
});
