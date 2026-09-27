import { describe, expect, it } from 'vitest';
import { castAll } from './cast.js';
import { seededRng } from './rng.js';
import { METHODS } from './types.js';

describe('castAll', () => {
  it('returns all seven methods in METHODS order for a complete profile', () => {
    const r = castAll({ birthDate: '1990-06-15', fullName: 'Ada Lovelace', bloodType: 'O' }, seededRng(1));
    expect(r.map((x) => x.method)).toEqual([...METHODS]);
  });
  it('omits blood type when unknown, keeps numerology without a name', () => {
    const r = castAll({ birthDate: '1990-06-15', fullName: null, bloodType: null }, seededRng(1));
    expect(r.map((x) => x.method)).toEqual(['TAROT', 'RUNE', 'ICHING', 'WESTERN', 'CHINESE', 'NUMEROLOGY']);
    expect(r.find((x) => x.method === 'NUMEROLOGY')!.data).toEqual({ lifePath: 4, expression: null });
  });
  it('is deterministic for a given seed', () => {
    const p = { birthDate: '1990-06-15', fullName: null, bloodType: 'A' as const };
    expect(castAll(p, seededRng(5))).toEqual(castAll(p, seededRng(5)));
  });
});
