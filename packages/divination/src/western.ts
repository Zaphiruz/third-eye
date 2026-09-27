import type { Profile, WesternData, ZodiacSignId } from './types.js';
import { ZODIAC_SIGNS } from './data/zodiac.js';

// Signs ordered by start date within the calendar year (Aquarius on Jan 20 … Capricorn on Dec 22).
const BY_START = [...ZODIAC_SIGNS].sort((a, b) => (a.start[0] * 100 + a.start[1]) - (b.start[0] * 100 + b.start[1]));

export function sunSign(birthDate: string): ZodiacSignId {
  const md = Number(birthDate.slice(5, 7)) * 100 + Number(birthDate.slice(8, 10));
  let sign: ZodiacSignId = 'capricorn'; // Jan 1–19 belong to the sign that started on Dec 22
  for (const s of BY_START) if (md >= s.start[0] * 100 + s.start[1]) sign = s.id;
  return sign;
}

export function castWestern(p: Profile): WesternData {
  return { sign: sunSign(p.birthDate) };
}
