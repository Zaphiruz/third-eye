import type { MethodResult, Profile, Rng } from './types.js';
import { castTarot } from './tarot.js';
import { castRune } from './runes.js';
import { castIChing } from './iching.js';
import { castSky } from './sky.js';
import { castWestern } from './western.js';
import { castChinese } from './chinese.js';
import { castNumerology } from './numerology.js';
import { castBloodType } from './bloodtype.js';

/** skyAt: the instant to cast the sky for (the backend uses local noon on the fortune's date). */
export interface CastContext { skyAt: Date }

/** Draws and computes every method the profile supports, in METHODS order. */
export function castAll(profile: Profile, rng: Rng, ctx: CastContext): MethodResult[] {
  const out: MethodResult[] = [
    { method: 'TAROT', data: castTarot(rng) },
    { method: 'RUNE', data: castRune(rng) },
    { method: 'ICHING', data: castIChing(rng) },
    { method: 'SKY', data: castSky(ctx.skyAt) },
    { method: 'WESTERN', data: castWestern(profile) },
    { method: 'CHINESE', data: castChinese(profile) },
    { method: 'NUMEROLOGY', data: castNumerology(profile) },
  ];
  const blood = castBloodType(profile);
  if (blood) out.push({ method: 'BLOODTYPE', data: blood });
  return out;
}
