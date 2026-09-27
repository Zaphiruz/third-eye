import { describe, expect, it } from 'vitest';
import { castRune } from './runes.js';
import { RUNES, getRune } from './data/runes.js';
import { seededRng } from './rng.js';

describe('runes', () => {
  it('has the 24 Elder Futhark runes in order with unique glyphs', () => {
    expect(RUNES).toHaveLength(24);
    expect(RUNES[0]!.id).toBe('fehu');
    expect(RUNES[23]!.id).toBe('othala');
    expect(new Set(RUNES.map((r) => r.glyph)).size).toBe(24);
  });
  it('marks exactly nine runes as non-reversible', () => {
    expect(RUNES.filter((r) => r.reversedMeaning === null).map((r) => r.id).sort()).toEqual(
      ['dagaz', 'eihwaz', 'gebo', 'hagalaz', 'ingwaz', 'isa', 'jera', 'naudhiz', 'sowilo'],
    );
  });
  it('never reverses a non-reversible rune, and does reverse others sometimes', () => {
    const draws = Array.from({ length: 400 }, (_, i) => castRune(seededRng(i)));
    for (const d of draws) if (getRune(d.id).reversedMeaning === null) expect(d.reversed).toBe(false);
    expect(draws.some((d) => d.reversed)).toBe(true);
    expect(new Set(draws.map((d) => d.id)).size).toBe(24);
  });
});
