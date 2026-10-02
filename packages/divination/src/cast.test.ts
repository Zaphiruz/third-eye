import { describe, expect, it } from 'vitest';
import { castAll } from './cast.js';
import { castSky } from './sky.js';
import { seededRng } from './rng.js';
import { METHODS } from './types.js';

const ctx = { skyAt: new Date('2026-09-30T12:00:00Z') };

describe('castAll', () => {
  it('returns all eight methods in METHODS order for a complete profile', () => {
    const r = castAll({ birthDate: '1990-06-15', fullName: 'Ada Lovelace', bloodType: 'O' }, seededRng(1), ctx);
    expect(r.map((x) => x.method)).toEqual([...METHODS]);
  });
  it('omits blood type when unknown, keeps numerology without a name', () => {
    const r = castAll({ birthDate: '1990-06-15', fullName: null, bloodType: null }, seededRng(1), ctx);
    expect(r.map((x) => x.method)).toEqual(['TAROT', 'RUNE', 'ICHING', 'SKY', 'WESTERN', 'CHINESE', 'NUMEROLOGY']);
    expect(r.find((x) => x.method === 'NUMEROLOGY')!.data).toEqual({ lifePath: 4, expression: null });
  });
  it('casts the sky for ctx.skyAt', () => {
    const r = castAll({ birthDate: '1990-06-15', fullName: null, bloodType: null }, seededRng(1), ctx);
    expect(r.find((x) => x.method === 'SKY')!.data).toEqual(castSky(ctx.skyAt));
  });
  it('is deterministic for a given seed and instant', () => {
    const p = { birthDate: '1990-06-15', fullName: null, bloodType: 'A' as const };
    expect(castAll(p, seededRng(5), ctx)).toEqual(castAll(p, seededRng(5), ctx));
  });
});
