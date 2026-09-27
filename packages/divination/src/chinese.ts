import type { ChineseData, Profile } from './types.js';
import { LUNAR_NEW_YEAR, LUNAR_NEW_YEAR_FIRST_YEAR } from './data/lunar-new-year.js';
import { CHINESE_ANIMALS, CHINESE_ELEMENTS } from './data/chinese.js';

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** The lunar year a Gregorian date belongs to. */
export function lunarYearOf(birthDate: string): number {
  const year = Number(birthDate.slice(0, 4));
  const md = LUNAR_NEW_YEAR[year - LUNAR_NEW_YEAR_FIRST_YEAR];
  if (!md) throw new RangeError(`No Lunar New Year data for ${year}`);
  return birthDate < `${birthDate.slice(0, 4)}-${md}` ? year - 1 : year;
}

export function castChinese(p: Profile): ChineseData {
  const lunarYear = lunarYearOf(p.birthDate);
  // 1984 = Jia-Zi: Wood Rat, the start of a 60-year cycle. Stems pair up by element (Jia/Yi = wood, …).
  const stem = mod(lunarYear - 4, 10);
  return {
    animal: CHINESE_ANIMALS[mod(lunarYear - 4, 12)]!.id,
    element: CHINESE_ELEMENTS[Math.floor(stem / 2)]!.id,
    polarity: stem % 2 === 0 ? 'yang' : 'yin',
    lunarYear,
  };
}
