# Third Eye — Part 2: Divination Engine (Tasks 5–12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Read the index first: [2026-09-26-third-eye.md](2026-09-26-third-eye.md). Everything in this part lives in `packages/divination/src/` and must stay **pure** (no Node built-ins, no `Math.random`, no `Date.now`, no I/O). All randomness comes from the injected `Rng`. Every test command below is `pnpm --filter @third-eye/divination test` unless stated.

Each method module exports a `cast…` function returning its data, or `null` when the profile lacks the input it needs. Reference data lives in `src/data/` and every entry is keyed by a stable id that is persisted in the database — **never rename an id** once shipped.

---

### Task 5: Seeded RNG and Western sun sign

**Files:**
- Create: `packages/divination/src/rng.ts`, `packages/divination/src/data/zodiac.ts`, `packages/divination/src/western.ts`
- Modify: `packages/divination/src/index.ts`
- Test: `packages/divination/src/rng.test.ts`, `packages/divination/src/western.test.ts`

**Interfaces:**
- Consumes: `Rng`, `Profile`, `ZodiacSignId`, `WesternData` from `types.ts`.
- Produces: `seededRng(seed: number): Rng`, `shuffle<T>(items: readonly T[], rng: Rng): T[]`, `ZODIAC_SIGNS: ZodiacSign[]`, `getZodiacSign(id): ZodiacSign`, `sunSign(birthDate: string): ZodiacSignId`, `castWestern(p: Profile): WesternData`.

- [ ] **Step 1: Write the failing tests**

`packages/divination/src/rng.test.ts`:
```ts
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
```

`packages/divination/src/western.test.ts`:
```ts
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
```

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL — cannot resolve `./rng.js` / `./western.js`.

- [ ] **Step 2: Implement the RNG**

`packages/divination/src/rng.ts`:
```ts
import type { Rng } from './types.js';

/** mulberry32 — small, fast, deterministic. For tests and reproducible seeds only. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return (maxExclusive) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const f = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(f * maxExclusive);
  };
}

/** Fisher–Yates. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
```

- [ ] **Step 3: Zodiac data and sun sign**

`packages/divination/src/data/zodiac.ts`:
```ts
import type { ZodiacSignId } from '../types.js';

export interface ZodiacSign {
  id: ZodiacSignId; name: string; glyph: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water'; modality: 'Cardinal' | 'Fixed' | 'Mutable';
  ruler: string;
  /** First day of the sign (tropical, conventional boundaries) as [month, day]. */
  start: [number, number];
  traits: string[];
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  { id: 'aries', name: 'Aries', glyph: '♈', element: 'Fire', modality: 'Cardinal', ruler: 'Mars', start: [3, 21], traits: ['bold', 'energetic', 'impulsive'] },
  { id: 'taurus', name: 'Taurus', glyph: '♉', element: 'Earth', modality: 'Fixed', ruler: 'Venus', start: [4, 20], traits: ['steady', 'sensual', 'stubborn'] },
  { id: 'gemini', name: 'Gemini', glyph: '♊', element: 'Air', modality: 'Mutable', ruler: 'Mercury', start: [5, 21], traits: ['curious', 'adaptable', 'restless'] },
  { id: 'cancer', name: 'Cancer', glyph: '♋', element: 'Water', modality: 'Cardinal', ruler: 'the Moon', start: [6, 21], traits: ['nurturing', 'intuitive', 'protective'] },
  { id: 'leo', name: 'Leo', glyph: '♌', element: 'Fire', modality: 'Fixed', ruler: 'the Sun', start: [7, 23], traits: ['warm', 'expressive', 'proud'] },
  { id: 'virgo', name: 'Virgo', glyph: '♍', element: 'Earth', modality: 'Mutable', ruler: 'Mercury', start: [8, 23], traits: ['precise', 'helpful', 'analytical'] },
  { id: 'libra', name: 'Libra', glyph: '♎', element: 'Air', modality: 'Cardinal', ruler: 'Venus', start: [9, 23], traits: ['harmonious', 'fair-minded', 'indecisive'] },
  { id: 'scorpio', name: 'Scorpio', glyph: '♏', element: 'Water', modality: 'Fixed', ruler: 'Pluto and Mars', start: [10, 23], traits: ['intense', 'perceptive', 'private'] },
  { id: 'sagittarius', name: 'Sagittarius', glyph: '♐', element: 'Fire', modality: 'Mutable', ruler: 'Jupiter', start: [11, 22], traits: ['adventurous', 'optimistic', 'blunt'] },
  { id: 'capricorn', name: 'Capricorn', glyph: '♑', element: 'Earth', modality: 'Cardinal', ruler: 'Saturn', start: [12, 22], traits: ['disciplined', 'ambitious', 'reserved'] },
  { id: 'aquarius', name: 'Aquarius', glyph: '♒', element: 'Air', modality: 'Fixed', ruler: 'Uranus and Saturn', start: [1, 20], traits: ['inventive', 'independent', 'detached'] },
  { id: 'pisces', name: 'Pisces', glyph: '♓', element: 'Water', modality: 'Mutable', ruler: 'Neptune and Jupiter', start: [2, 19], traits: ['empathetic', 'imaginative', 'elusive'] },
];

const BY_ID = new Map(ZODIAC_SIGNS.map((s) => [s.id, s]));
export function getZodiacSign(id: ZodiacSignId): ZodiacSign {
  const s = BY_ID.get(id);
  if (!s) throw new RangeError(`Unknown zodiac sign: ${id}`);
  return s;
}
```

`packages/divination/src/western.ts`:
```ts
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
```

Update `packages/divination/src/index.ts`:
```ts
export * from './types.js';
export * from './rng.js';
export * from './data/zodiac.js';
export * from './western.js';
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @third-eye/divination test`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(divination): seeded rng and western sun sign

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Chinese zodiac

**Files:**
- Create: `packages/divination/src/data/lunar-new-year.ts`, `packages/divination/src/data/chinese.ts`, `packages/divination/src/chinese.ts`
- Modify: `packages/divination/src/index.ts`
- Test: `packages/divination/src/chinese.test.ts`

**Interfaces:**
- Consumes: `Profile`, `ChineseData`, `ChineseAnimalId`, `ChineseElementId`.
- Produces: `LUNAR_NEW_YEAR_FIRST_YEAR`, `LUNAR_NEW_YEAR`, `lunarYearOf(birthDate): number`, `CHINESE_ANIMALS`, `CHINESE_ELEMENTS`, `getChineseAnimal(id)`, `getChineseElement(id)`, `castChinese(p: Profile): ChineseData`.

The Chinese zodiac year starts at Lunar New Year, not January 1st. The table below (Lunar New Year's Gregorian date for 1900–2100) was generated with the `lunar-javascript` library and spot-checked against known dates (1900-01-31, 1984-02-02, 2000-02-05, 2024-02-10, 2025-01-29, 2026-02-17). Copy it verbatim.

- [ ] **Step 1: Write the failing test**

`packages/divination/src/chinese.test.ts`:
```ts
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
```

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL — cannot resolve `./chinese.js`.

- [ ] **Step 2: Lunar New Year table**

`packages/divination/src/data/lunar-new-year.ts`:
```ts
/** Gregorian month-day of Lunar New Year (正月初一), index 0 = 1900. Generated with lunar-javascript. */
export const LUNAR_NEW_YEAR_FIRST_YEAR = 1900;

export const LUNAR_NEW_YEAR: readonly string[] = [
  '01-31', '02-19', '02-08', '01-29', '02-16', '02-04', '01-25', '02-13', '02-02', '01-22', // 1900
  '02-10', '01-30', '02-18', '02-06', '01-26', '02-14', '02-03', '01-23', '02-11', '02-01', // 1910
  '02-20', '02-08', '01-28', '02-16', '02-05', '01-24', '02-13', '02-02', '01-23', '02-10', // 1920
  '01-30', '02-17', '02-06', '01-26', '02-14', '02-04', '01-24', '02-11', '01-31', '02-19', // 1930
  '02-08', '01-27', '02-15', '02-05', '01-25', '02-13', '02-02', '01-22', '02-10', '01-29', // 1940
  '02-17', '02-06', '01-27', '02-14', '02-03', '01-24', '02-12', '01-31', '02-18', '02-08', // 1950
  '01-28', '02-15', '02-05', '01-25', '02-13', '02-02', '01-21', '02-09', '01-30', '02-17', // 1960
  '02-06', '01-27', '02-15', '02-03', '01-23', '02-11', '01-31', '02-18', '02-07', '01-28', // 1970
  '02-16', '02-05', '01-25', '02-13', '02-02', '02-20', '02-09', '01-29', '02-17', '02-06', // 1980
  '01-27', '02-15', '02-04', '01-23', '02-10', '01-31', '02-19', '02-07', '01-28', '02-16', // 1990
  '02-05', '01-24', '02-12', '02-01', '01-22', '02-09', '01-29', '02-18', '02-07', '01-26', // 2000
  '02-14', '02-03', '01-23', '02-10', '01-31', '02-19', '02-08', '01-28', '02-16', '02-05', // 2010
  '01-25', '02-12', '02-01', '01-22', '02-10', '01-29', '02-17', '02-06', '01-26', '02-13', // 2020
  '02-03', '01-23', '02-11', '01-31', '02-19', '02-08', '01-28', '02-15', '02-04', '01-24', // 2030
  '02-12', '02-01', '01-22', '02-10', '01-30', '02-17', '02-06', '01-26', '02-14', '02-02', // 2040
  '01-23', '02-11', '02-01', '02-19', '02-08', '01-28', '02-15', '02-04', '01-24', '02-12', // 2050
  '02-02', '01-21', '02-09', '01-29', '02-17', '02-05', '01-26', '02-14', '02-03', '01-23', // 2060
  '02-11', '01-31', '02-19', '02-07', '01-27', '02-15', '02-05', '01-24', '02-12', '02-02', // 2070
  '01-22', '02-09', '01-29', '02-17', '02-06', '01-26', '02-14', '02-03', '01-24', '02-10', // 2080
  '01-30', '02-18', '02-07', '01-27', '02-15', '02-05', '01-25', '02-12', '02-01', '01-21', // 2090
  '02-09', // 2100
];
```

- [ ] **Step 3: Animal and element data**

`packages/divination/src/data/chinese.ts`:
```ts
import type { ChineseAnimalId, ChineseElementId } from '../types.js';

export interface ChineseAnimal { id: ChineseAnimalId; name: string; glyph: string; traits: string[] }
export interface ChineseElement { id: ChineseElementId; name: string; traits: string[] }

/** Cycle order: index 0 (Rat) = lunar years 1924, 1936, 1948, … */
export const CHINESE_ANIMALS: ChineseAnimal[] = [
  { id: 'rat', name: 'Rat', glyph: '鼠', traits: ['quick-witted', 'resourceful', 'charming'] },
  { id: 'ox', name: 'Ox', glyph: '牛', traits: ['dependable', 'patient', 'determined'] },
  { id: 'tiger', name: 'Tiger', glyph: '虎', traits: ['brave', 'confident', 'unpredictable'] },
  { id: 'rabbit', name: 'Rabbit', glyph: '兔', traits: ['gentle', 'elegant', 'cautious'] },
  { id: 'dragon', name: 'Dragon', glyph: '龍', traits: ['ambitious', 'charismatic', 'energetic'] },
  { id: 'snake', name: 'Snake', glyph: '蛇', traits: ['wise', 'intuitive', 'enigmatic'] },
  { id: 'horse', name: 'Horse', glyph: '馬', traits: ['free-spirited', 'energetic', 'impatient'] },
  { id: 'goat', name: 'Goat', glyph: '羊', traits: ['gentle', 'creative', 'sympathetic'] },
  { id: 'monkey', name: 'Monkey', glyph: '猴', traits: ['clever', 'playful', 'inventive'] },
  { id: 'rooster', name: 'Rooster', glyph: '雞', traits: ['observant', 'hardworking', 'candid'] },
  { id: 'dog', name: 'Dog', glyph: '狗', traits: ['loyal', 'honest', 'protective'] },
  { id: 'pig', name: 'Pig', glyph: '豬', traits: ['generous', 'sincere', 'easygoing'] },
];

export const CHINESE_ELEMENTS: ChineseElement[] = [
  { id: 'wood', name: 'Wood', traits: ['growth', 'flexibility', 'generosity'] },
  { id: 'fire', name: 'Fire', traits: ['passion', 'dynamism', 'leadership'] },
  { id: 'earth', name: 'Earth', traits: ['stability', 'practicality', 'patience'] },
  { id: 'metal', name: 'Metal', traits: ['determination', 'discipline', 'clarity'] },
  { id: 'water', name: 'Water', traits: ['adaptability', 'intuition', 'diplomacy'] },
];

export const getChineseAnimal = (id: ChineseAnimalId): ChineseAnimal => CHINESE_ANIMALS.find((a) => a.id === id)!;
export const getChineseElement = (id: ChineseElementId): ChineseElement => CHINESE_ELEMENTS.find((e) => e.id === id)!;
```

- [ ] **Step 4: Implement `castChinese`**

`packages/divination/src/chinese.ts`:
```ts
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
```

Add to `packages/divination/src/index.ts`:
```ts
export * from './data/lunar-new-year.js';
export * from './data/chinese.js';
export * from './chinese.js';
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @third-eye/divination test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(divination): chinese zodiac with lunar new year boundaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Numerology

**Files:**
- Create: `packages/divination/src/data/numbers.ts`, `packages/divination/src/numerology.ts`
- Modify: `packages/divination/src/index.ts`
- Test: `packages/divination/src/numerology.test.ts`

**Interfaces:**
- Produces: `reduceNumber(n: number): number`, `lifePathNumber(birthDate): number`, `expressionNumber(fullName: string): number | null`, `castNumerology(p: Profile): NumerologyData`, `NUMBER_MEANINGS: Record<number, NumberMeaning>`, `getNumberMeaning(n)`.

Rules (Pythagorean): reduce by summing digits until one digit, **except** 11, 22 and 33 are kept. Life Path = reduce(reduce(month) + reduce(day) + reduce(year)). Expression = reduce(sum of letter values of the full name), with A=1 … I=9, J=1 … R=9, S=1 … Z=8; diacritics are stripped (Zoë → ZOE) and non-Latin characters ignored. No Latin letters → `null`.

- [ ] **Step 1: Write the failing test**

`packages/divination/src/numerology.test.ts`:
```ts
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
```

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL — cannot resolve `./numerology.js`.

- [ ] **Step 2: Implement**

`packages/divination/src/data/numbers.ts`:
```ts
export interface NumberMeaning { title: string; keywords: string[]; master: boolean }

export const NUMBER_MEANINGS: Record<number, NumberMeaning> = {
  1: { title: 'The Leader', keywords: ['independence', 'initiative', 'drive'], master: false },
  2: { title: 'The Peacemaker', keywords: ['cooperation', 'sensitivity', 'diplomacy'], master: false },
  3: { title: 'The Communicator', keywords: ['expression', 'creativity', 'joy'], master: false },
  4: { title: 'The Builder', keywords: ['stability', 'discipline', 'hard work'], master: false },
  5: { title: 'The Adventurer', keywords: ['freedom', 'change', 'curiosity'], master: false },
  6: { title: 'The Nurturer', keywords: ['responsibility', 'care', 'harmony'], master: false },
  7: { title: 'The Seeker', keywords: ['introspection', 'analysis', 'spirituality'], master: false },
  8: { title: 'The Powerhouse', keywords: ['ambition', 'authority', 'abundance'], master: false },
  9: { title: 'The Humanitarian', keywords: ['compassion', 'completion', 'idealism'], master: false },
  11: { title: 'The Intuitive', keywords: ['insight', 'inspiration', 'sensitivity'], master: true },
  22: { title: 'The Master Builder', keywords: ['vision', 'practicality', 'large-scale achievement'], master: true },
  33: { title: 'The Master Teacher', keywords: ['compassion', 'guidance', 'selfless service'], master: true },
};

export function getNumberMeaning(n: number): NumberMeaning {
  const m = NUMBER_MEANINGS[n];
  if (!m) throw new RangeError(`No meaning for ${n}`);
  return m;
}
```

`packages/divination/src/numerology.ts`:
```ts
import type { NumerologyData, Profile } from './types.js';

const MASTER = new Set([11, 22, 33]);
const digitSum = (n: number) => String(n).split('').reduce((s, d) => s + Number(d), 0);

export function reduceNumber(n: number): number {
  let x = n;
  while (x > 9 && !MASTER.has(x)) x = digitSum(x);
  return x;
}

export function lifePathNumber(birthDate: string): number {
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  return reduceNumber(reduceNumber(m) + reduceNumber(d) + reduceNumber(y));
}

/** A=1 … I=9, J=1 … R=9, S=1 … Z=8. */
const letterValue = (ch: string) => ((ch.charCodeAt(0) - 65) % 9) + 1;

export function expressionNumber(fullName: string): number | null {
  const letters = fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return null;
  return reduceNumber([...letters].reduce((s, ch) => s + letterValue(ch), 0));
}

export function castNumerology(p: Profile): NumerologyData {
  return { lifePath: lifePathNumber(p.birthDate), expression: p.fullName ? expressionNumber(p.fullName) : null };
}
```

Add to `index.ts`:
```ts
export * from './data/numbers.js';
export * from './numerology.js';
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @third-eye/divination test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(divination): numerology life path and expression numbers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Blood type

**Files:**
- Create: `packages/divination/src/data/blood-types.ts`, `packages/divination/src/bloodtype.ts`
- Modify: `packages/divination/src/index.ts`
- Test: `packages/divination/src/bloodtype.test.ts`

**Interfaces:**
- Produces: `BLOOD_TYPES: Record<BloodType, BloodTypeProfile>`, `castBloodType(p: Profile): BloodTypeData | null`.

- [ ] **Step 1: Write the failing test**

`packages/divination/src/bloodtype.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { castBloodType } from './bloodtype.js';
import { BLOOD_TYPES } from './data/blood-types.js';

describe('castBloodType', () => {
  it('returns null without a blood type', () => {
    expect(castBloodType({ birthDate: '1990-06-15', fullName: null, bloodType: null })).toBeNull();
  });
  it('wraps the type', () => {
    expect(castBloodType({ birthDate: '1990-06-15', fullName: null, bloodType: 'AB' })).toEqual({ type: 'AB' });
  });
  it('has a profile for every type', () => {
    expect(Object.keys(BLOOD_TYPES).sort()).toEqual(['A', 'AB', 'B', 'O']);
  });
});
```

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL — cannot resolve `./bloodtype.js`.

- [ ] **Step 2: Implement**

`packages/divination/src/data/blood-types.ts`:
```ts
import type { BloodType } from '../types.js';

/** Japanese ketsueki-gata (blood-type personality) archetypes. */
export interface BloodTypeProfile { title: string; traits: string[] }

export const BLOOD_TYPES: Record<BloodType, BloodTypeProfile> = {
  A: { title: 'The Careful Planner', traits: ['earnest', 'responsible', 'sensitive', 'perfectionist'] },
  B: { title: 'The Free Spirit', traits: ['passionate', 'creative', 'independent', 'unconventional'] },
  O: { title: 'The Confident Leader', traits: ['confident', 'generous', 'ambitious', 'resilient'] },
  AB: { title: 'The Enigmatic Dreamer', traits: ['rational', 'adaptable', 'dual-natured', 'imaginative'] },
};
```

`packages/divination/src/bloodtype.ts`:
```ts
import type { BloodTypeData, Profile } from './types.js';

export function castBloodType(p: Profile): BloodTypeData | null {
  return p.bloodType ? { type: p.bloodType } : null;
}
```

Add to `index.ts`:
```ts
export * from './data/blood-types.js';
export * from './bloodtype.js';
```

- [ ] **Step 3: Run tests, commit**

Run: `pnpm --filter @third-eye/divination test`
Expected: PASS.

```bash
git add -A
git commit -m "feat(divination): blood type personality

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tarot

**Files:**
- Create: `packages/divination/src/data/tarot.ts`, `packages/divination/src/tarot.ts`
- Modify: `packages/divination/src/index.ts`
- Test: `packages/divination/src/tarot.test.ts`

**Interfaces:**
- Produces: `TAROT_CARDS: TarotCard[]` (78), `getTarotCard(id): TarotCard`, `TAROT_POSITIONS: TarotPosition[]` (`['situation', 'challenge', 'advice']`), `castTarot(rng: Rng): TarotData`.
- Card ids: majors `major-00` … `major-21`; minors `<suit>-<rank>` with two-digit rank `01` (Ace) … `10`, `11` Page, `12` Knight, `13` Queen, `14` King; suits `wands`, `cups`, `swords`, `pentacles`.

- [ ] **Step 1: Write the failing test**

`packages/divination/src/tarot.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { castTarot } from './tarot.js';
import { TAROT_CARDS, getTarotCard } from './data/tarot.js';
import { seededRng } from './rng.js';

describe('tarot deck', () => {
  it('has 78 unique cards: 22 majors and 14 of each suit', () => {
    expect(TAROT_CARDS).toHaveLength(78);
    expect(new Set(TAROT_CARDS.map((c) => c.id)).size).toBe(78);
    expect(TAROT_CARDS.filter((c) => c.arcana === 'major')).toHaveLength(22);
    for (const suit of ['wands', 'cups', 'swords', 'pentacles']) {
      expect(TAROT_CARDS.filter((c) => c.suit === suit)).toHaveLength(14);
    }
  });
  it('names cards conventionally', () => {
    expect(getTarotCard('major-00').name).toBe('The Fool');
    expect(getTarotCard('major-16').name).toBe('The Tower');
    expect(getTarotCard('cups-01').name).toBe('Ace of Cups');
    expect(getTarotCard('swords-12').name).toBe('Knight of Swords');
    expect(getTarotCard('pentacles-14').name).toBe('King of Pentacles');
  });
  it('gives every card upright and reversed keywords', () => {
    for (const c of TAROT_CARDS) {
      expect(c.upright.length).toBeGreaterThanOrEqual(3);
      expect(c.reversed.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('castTarot', () => {
  it('draws three distinct cards into the three positions', () => {
    const d = castTarot(seededRng(3));
    expect(d.cards.map((c) => c.position)).toEqual(['situation', 'challenge', 'advice']);
    expect(new Set(d.cards.map((c) => c.id)).size).toBe(3);
    for (const c of d.cards) expect(() => getTarotCard(c.id)).not.toThrow();
  });
  it('is deterministic for a seed and produces both orientations across seeds', () => {
    expect(castTarot(seededRng(9))).toEqual(castTarot(seededRng(9)));
    const orientations = new Set(
      Array.from({ length: 50 }, (_, i) => castTarot(seededRng(i))).flatMap((d) => d.cards.map((c) => c.reversed)),
    );
    expect(orientations).toEqual(new Set([true, false]));
  });
});
```

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL — cannot resolve `./tarot.js`.

- [ ] **Step 2: Tarot data**

`packages/divination/src/data/tarot.ts`:
```ts
import type { TarotPosition } from '../types.js';

export type TarotSuit = 'wands' | 'cups' | 'swords' | 'pentacles';
export interface TarotCard {
  id: string; name: string; arcana: 'major' | 'minor';
  suit: TarotSuit | null; rank: number;   // majors: 0–21; minors: 1–14
  upright: string[]; reversed: string[];
}

export const TAROT_POSITIONS: TarotPosition[] = ['situation', 'challenge', 'advice'];

type K = [string[], string[]];
const MAJORS: [string, ...K][] = [
  ['The Fool', ['beginnings', 'spontaneity', 'leap of faith'], ['recklessness', 'hesitation', 'naivety']],
  ['The Magician', ['willpower', 'skill', 'manifestation'], ['manipulation', 'untapped talent', 'trickery']],
  ['The High Priestess', ['intuition', 'mystery', 'inner voice'], ['secrets', 'disconnection', 'ignored instincts']],
  ['The Empress', ['abundance', 'nurturing', 'creativity'], ['dependence', 'smothering', 'creative block']],
  ['The Emperor', ['structure', 'authority', 'stability'], ['rigidity', 'control', 'domination']],
  ['The Hierophant', ['tradition', 'guidance', 'belonging'], ['rebellion', 'dogma', 'unconventional paths']],
  ['The Lovers', ['union', 'alignment', 'choice'], ['disharmony', 'imbalance', 'misaligned values']],
  ['The Chariot', ['determination', 'momentum', 'victory'], ['lack of direction', 'aggression', 'stalled progress']],
  ['Strength', ['courage', 'compassion', 'inner strength'], ['self-doubt', 'weakness', 'raw emotion']],
  ['The Hermit', ['introspection', 'solitude', 'guidance'], ['isolation', 'loneliness', 'withdrawal']],
  ['Wheel of Fortune', ['cycles', 'luck', 'turning point'], ['resistance to change', 'bad luck', 'stagnation']],
  ['Justice', ['fairness', 'truth', 'accountability'], ['injustice', 'dishonesty', 'avoidance']],
  ['The Hanged Man', ['surrender', 'new perspective', 'pause'], ['stalling', 'resistance', 'needless sacrifice']],
  ['Death', ['endings', 'transformation', 'release'], ['clinging', 'fear of change', 'stagnation']],
  ['Temperance', ['balance', 'moderation', 'patience'], ['excess', 'imbalance', 'haste']],
  ['The Devil', ['attachment', 'temptation', 'shadow self'], ['release', 'breaking free', 'reclaiming power']],
  ['The Tower', ['upheaval', 'revelation', 'sudden change'], ['averted disaster', 'delayed change', 'fear of collapse']],
  ['The Star', ['hope', 'renewal', 'inspiration'], ['discouragement', 'lost faith', 'disconnection']],
  ['The Moon', ['illusion', 'intuition', 'the unconscious'], ['confusion lifting', 'repressed fear', 'clarity']],
  ['The Sun', ['joy', 'vitality', 'success'], ['dimmed enthusiasm', 'delay', 'overconfidence']],
  ['Judgement', ['awakening', 'reckoning', 'renewal'], ['self-doubt', 'harsh judgement', 'ignoring the call']],
  ['The World', ['completion', 'wholeness', 'fulfilment'], ['loose ends', 'lack of closure', 'shortcuts']],
];

const RANK_NAMES = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];

/** Index 0 = Ace … 13 = King. */
const MINORS: Record<TarotSuit, K[]> = {
  wands: [
    [['inspiration', 'new venture', 'spark'], ['delays', 'lack of motivation', 'false start']],
    [['planning', 'future vision', 'decisions'], ['fear of the unknown', 'poor planning', 'playing safe']],
    [['expansion', 'foresight', 'progress'], ['obstacles', 'delays', 'frustration']],
    [['celebration', 'harmony', 'homecoming'], ['instability', 'transition', 'lack of support']],
    [['competition', 'conflict', 'rivalry'], ['avoiding conflict', 'tension released', 'compromise']],
    [['victory', 'recognition', 'confidence'], ['ego', 'fall from grace', 'lack of recognition']],
    [['defence', 'perseverance', 'standing ground'], ['overwhelm', 'giving up', 'exhaustion']],
    [['speed', 'movement', 'swift news'], ['delays', 'frustration', 'waiting']],
    [['resilience', 'persistence', 'last stand'], ['fatigue', 'paranoia', 'defensiveness']],
    [['burden', 'responsibility', 'hard work'], ['delegation', 'release', 'collapse under weight']],
    [['enthusiasm', 'exploration', 'discovery'], ['scattered energy', 'hasty decisions', 'lack of direction']],
    [['energy', 'adventure', 'impulsiveness'], ['recklessness', 'impatience', 'burnout']],
    [['confidence', 'warmth', 'determination'], ['jealousy', 'insecurity', 'demanding']],
    [['leadership', 'vision', 'boldness'], ['impulsiveness', 'arrogance', 'high expectations']],
  ],
  cups: [
    [['new love', 'compassion', 'emotional beginning'], ['blocked emotions', 'emptiness', 'self-neglect']],
    [['partnership', 'connection', 'mutual attraction'], ['imbalance', 'broken bond', 'miscommunication']],
    [['friendship', 'celebration', 'community'], ['overindulgence', 'gossip', 'isolation']],
    [['contemplation', 'apathy', 'reevaluation'], ['renewed interest', 'acceptance', 'new perspective']],
    [['loss', 'grief', 'regret'], ['acceptance', 'moving on', 'forgiveness']],
    [['nostalgia', 'childhood', 'innocence'], ['stuck in the past', 'rose-tinted memories', 'moving forward']],
    [['choices', 'fantasy', 'illusion'], ['clarity', 'focus', 'decisive action']],
    [['walking away', 'seeking meaning', 'withdrawal'], ['fear of change', 'aimless drifting', 'staying put']],
    [['contentment', 'wishes fulfilled', 'satisfaction'], ['smugness', 'dissatisfaction', 'materialism']],
    [['harmony', 'family', 'lasting happiness'], ['disconnection', 'broken home', 'misaligned values']],
    [['creative spark', 'intuition', 'curiosity'], ['emotional immaturity', 'creative block', 'insecurity']],
    [['romance', 'charm', 'following the heart'], ['moodiness', 'unrealistic ideals', 'jealousy']],
    [['compassion', 'calm', 'emotional security'], ['codependence', 'martyrdom', 'emotional overwhelm']],
    [['emotional balance', 'diplomacy', 'generosity'], ['manipulation', 'moodiness', 'volatility']],
  ],
  swords: [
    [['clarity', 'breakthrough', 'truth'], ['confusion', 'chaos', 'misjudgement']],
    [['indecision', 'stalemate', 'difficult choice'], ['information overload', 'lesser of two evils', 'release']],
    [['heartbreak', 'sorrow', 'painful truth'], ['recovery', 'forgiveness', 'releasing pain']],
    [['rest', 'recovery', 'contemplation'], ['restlessness', 'burnout', 'stagnation']],
    [['conflict', 'winning at a cost', 'tension'], ['reconciliation', 'making amends', 'past resentment']],
    [['transition', 'moving on', 'calmer waters'], ['unfinished business', 'resistance to change', 'baggage']],
    [['strategy', 'stealth', 'deception'], ['confession', 'conscience', 'getting caught']],
    [['restriction', 'self-imposed limits', 'feeling trapped'], ['release', 'new perspective', 'freedom']],
    [['anxiety', 'worry', 'sleepless nights'], ['hope', 'reaching out', 'releasing worry']],
    [['painful ending', 'rock bottom', 'betrayal'], ['recovery', 'regeneration', 'resisting an inevitable end']],
    [['curiosity', 'new ideas', 'vigilance'], ['gossip', 'all talk', 'deception']],
    [['ambition', 'action', 'fast thinking'], ['restlessness', 'rudeness', 'no direction']],
    [['clear boundaries', 'honesty', 'independent thought'], ['coldness', 'bitterness', 'cruelty']],
    [['intellectual power', 'authority', 'truth'], ['manipulation', 'tyranny', 'abuse of power']],
  ],
  pentacles: [
    [['opportunity', 'prosperity', 'new venture'], ['lost opportunity', 'poor planning', 'scarcity mindset']],
    [['balance', 'adaptability', 'juggling priorities'], ['overcommitment', 'disorganisation', 'imbalance']],
    [['teamwork', 'craftsmanship', 'learning'], ['disharmony', 'poor quality', 'working alone']],
    [['security', 'saving', 'control'], ['greed', 'possessiveness', 'letting go']],
    [['hardship', 'insecurity', 'isolation'], ['recovery', 'accepting help', 'turning a corner']],
    [['generosity', 'giving', 'receiving'], ['debt', 'strings attached', 'one-sided charity']],
    [['patience', 'long-term view', 'investment'], ['impatience', 'poor returns', 'wasted effort']],
    [['diligence', 'mastery', 'skill building'], ['perfectionism', 'lack of focus', 'shortcuts']],
    [['abundance', 'self-sufficiency', 'refinement'], ['overwork', 'hustling', 'financial setbacks']],
    [['legacy', 'wealth', 'family'], ['financial loss', 'family conflict', 'fleeting success']],
    [['ambition', 'study', 'manifestation'], ['procrastination', 'lack of progress', 'missed lessons']],
    [['routine', 'responsibility', 'steady progress'], ['boredom', 'stagnation', 'perfectionism']],
    [['nurturing', 'practicality', 'comfort'], ['self-neglect', 'work-home imbalance', 'smothering']],
    [['abundance', 'security', 'discipline'], ['greed', 'stubbornness', 'indulgence']],
  ],
};

const pad = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export const TAROT_CARDS: TarotCard[] = [
  ...MAJORS.map(([name, upright, reversed], i): TarotCard => ({
    id: `major-${pad(i)}`, name, arcana: 'major', suit: null, rank: i, upright, reversed,
  })),
  ...(Object.keys(MINORS) as TarotSuit[]).flatMap((suit) =>
    MINORS[suit].map(([upright, reversed], i): TarotCard => ({
      id: `${suit}-${pad(i + 1)}`, name: `${RANK_NAMES[i]} of ${cap(suit)}`,
      arcana: 'minor', suit, rank: i + 1, upright, reversed,
    })),
  ),
];

const BY_ID = new Map(TAROT_CARDS.map((c) => [c.id, c]));
export function getTarotCard(id: string): TarotCard {
  const c = BY_ID.get(id);
  if (!c) throw new RangeError(`Unknown tarot card: ${id}`);
  return c;
}
```

- [ ] **Step 3: Implement the draw**

`packages/divination/src/tarot.ts`:
```ts
import type { Rng, TarotData } from './types.js';
import { TAROT_CARDS, TAROT_POSITIONS } from './data/tarot.js';
import { shuffle } from './rng.js';

export function castTarot(rng: Rng): TarotData {
  const drawn = shuffle(TAROT_CARDS, rng).slice(0, TAROT_POSITIONS.length);
  return {
    cards: drawn.map((card, i) => ({ id: card.id, reversed: rng(2) === 1, position: TAROT_POSITIONS[i]! })),
  };
}
```

Add to `index.ts`:
```ts
export * from './data/tarot.js';
export * from './tarot.js';
```

- [ ] **Step 4: Run tests, commit**

Run: `pnpm --filter @third-eye/divination test`
Expected: PASS.

```bash
git add -A
git commit -m "feat(divination): 78-card tarot deck and three-card spread

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Runes

**Files:**
- Create: `packages/divination/src/data/runes.ts`, `packages/divination/src/runes.ts`
- Modify: `packages/divination/src/index.ts`
- Test: `packages/divination/src/runes.test.ts`

**Interfaces:**
- Produces: `RUNES: Rune[]` (24, Elder Futhark order), `getRune(id): Rune`, `castRune(rng: Rng): RuneData`. `Rune.reversedMeaning` is `null` for the nine runes that look the same upside down (Gebo, Hagalaz, Naudhiz, Isa, Jera, Eihwaz, Sowilo, Ingwaz, Dagaz); those are never drawn reversed.

- [ ] **Step 1: Write the failing test**

`packages/divination/src/runes.test.ts`:
```ts
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
```

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL — cannot resolve `./runes.js`.

- [ ] **Step 2: Implement**

`packages/divination/src/data/runes.ts`:
```ts
export interface Rune { id: string; name: string; glyph: string; meaning: string[]; reversedMeaning: string[] | null }

export const RUNES: Rune[] = [
  { id: 'fehu', name: 'Fehu', glyph: 'ᚠ', meaning: ['wealth', 'abundance', 'earned reward'], reversedMeaning: ['loss', 'greed', 'setback'] },
  { id: 'uruz', name: 'Uruz', glyph: 'ᚢ', meaning: ['strength', 'vitality', 'endurance'], reversedMeaning: ['weakness', 'missed chance', 'low spirits'] },
  { id: 'thurisaz', name: 'Thurisaz', glyph: 'ᚦ', meaning: ['defence', 'conflict', 'catalyst'], reversedMeaning: ['danger', 'defencelessness', 'compulsion'] },
  { id: 'ansuz', name: 'Ansuz', glyph: 'ᚨ', meaning: ['communication', 'wisdom', 'divine message'], reversedMeaning: ['misunderstanding', 'deceit', 'bad counsel'] },
  { id: 'raidho', name: 'Raidho', glyph: 'ᚱ', meaning: ['journey', 'rhythm', 'right action'], reversedMeaning: ['disruption', 'stalled travel', 'injustice'] },
  { id: 'kenaz', name: 'Kenaz', glyph: 'ᚲ', meaning: ['illumination', 'creativity', 'knowledge'], reversedMeaning: ['darkness', 'blocked creativity', 'endings'] },
  { id: 'gebo', name: 'Gebo', glyph: 'ᚷ', meaning: ['gift', 'partnership', 'exchange'], reversedMeaning: null },
  { id: 'wunjo', name: 'Wunjo', glyph: 'ᚹ', meaning: ['joy', 'harmony', 'belonging'], reversedMeaning: ['sorrow', 'alienation', 'strife'] },
  { id: 'hagalaz', name: 'Hagalaz', glyph: 'ᚺ', meaning: ['disruption', 'uncontrolled forces', 'transformation'], reversedMeaning: null },
  { id: 'naudhiz', name: 'Naudhiz', glyph: 'ᚾ', meaning: ['need', 'constraint', 'endurance'], reversedMeaning: null },
  { id: 'isa', name: 'Isa', glyph: 'ᛁ', meaning: ['stillness', 'pause', 'clarity'], reversedMeaning: null },
  { id: 'jera', name: 'Jera', glyph: 'ᛃ', meaning: ['harvest', 'cycles', 'reward for patience'], reversedMeaning: null },
  { id: 'eihwaz', name: 'Eihwaz', glyph: 'ᛇ', meaning: ['endurance', 'protection', 'resilience'], reversedMeaning: null },
  { id: 'perthro', name: 'Perthro', glyph: 'ᛈ', meaning: ['mystery', 'fate', 'hidden things'], reversedMeaning: ['stagnation', 'secrets revealed', 'loneliness'] },
  { id: 'algiz', name: 'Algiz', glyph: 'ᛉ', meaning: ['protection', 'instinct', 'higher self'], reversedMeaning: ['vulnerability', 'hidden danger', 'warning'] },
  { id: 'sowilo', name: 'Sowilo', glyph: 'ᛊ', meaning: ['success', 'wholeness', 'the power of the sun'], reversedMeaning: null },
  { id: 'tiwaz', name: 'Tiwaz', glyph: 'ᛏ', meaning: ['justice', 'honour', 'courage'], reversedMeaning: ['injustice', 'imbalance', 'faltering will'] },
  { id: 'berkano', name: 'Berkano', glyph: 'ᛒ', meaning: ['growth', 'birth', 'renewal'], reversedMeaning: ['stagnation', 'anxiety', 'family troubles'] },
  { id: 'ehwaz', name: 'Ehwaz', glyph: 'ᛖ', meaning: ['movement', 'trust', 'teamwork'], reversedMeaning: ['restlessness', 'mistrust', 'disharmony'] },
  { id: 'mannaz', name: 'Mannaz', glyph: 'ᛗ', meaning: ['self', 'humanity', 'cooperation'], reversedMeaning: ['isolation', 'self-delusion', 'manipulation'] },
  { id: 'laguz', name: 'Laguz', glyph: 'ᛚ', meaning: ['flow', 'intuition', 'the unconscious'], reversedMeaning: ['confusion', 'fear', 'poor judgement'] },
  { id: 'ingwaz', name: 'Ingwaz', glyph: 'ᛜ', meaning: ['gestation', 'inner growth', 'completion'], reversedMeaning: null },
  { id: 'dagaz', name: 'Dagaz', glyph: 'ᛞ', meaning: ['breakthrough', 'awakening', 'daylight'], reversedMeaning: null },
  { id: 'othala', name: 'Othala', glyph: 'ᛟ', meaning: ['heritage', 'home', 'inheritance'], reversedMeaning: ['rootlessness', 'prejudice', 'loss of home'] },
];

const BY_ID = new Map(RUNES.map((r) => [r.id, r]));
export function getRune(id: string): Rune {
  const r = BY_ID.get(id);
  if (!r) throw new RangeError(`Unknown rune: ${id}`);
  return r;
}
```

`packages/divination/src/runes.ts`:
```ts
import type { Rng, RuneData } from './types.js';
import { RUNES } from './data/runes.js';

export function castRune(rng: Rng): RuneData {
  const rune = RUNES[rng(RUNES.length)]!;
  return { id: rune.id, reversed: rune.reversedMeaning !== null && rng(2) === 1 };
}
```

Add to `index.ts`:
```ts
export * from './data/runes.js';
export * from './runes.js';
```

- [ ] **Step 3: Run tests, commit**

Run: `pnpm --filter @third-eye/divination test`
Expected: PASS.

```bash
git add -A
git commit -m "feat(divination): elder futhark rune draw

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: I Ching

**Files:**
- Create: `packages/divination/src/data/hexagrams.ts`, `packages/divination/src/iching.ts`
- Modify: `packages/divination/src/index.ts`
- Test: `packages/divination/src/iching.test.ts`

**Interfaces:**
- Produces: `HEXAGRAMS: Hexagram[]` (64, index = number − 1), `getHexagram(n): Hexagram`, `hexagramNumber(bits: (0 | 1)[]): number` (bits bottom → top, 1 = yang), `hexagramLines(n): (0 | 1)[]`, `castIChing(rng: Rng): IChingData`.

**Method (three coins):** each coin is heads = 3 or tails = 2 (`rng(2) === 1 ? 3 : 2`). Three coins sum to a line value: 6 old yin (changing), 7 young yang, 8 young yin, 9 old yang (changing). Six lines are cast bottom to top. The primary hexagram uses yang for 7/9 and yin for 6/8. The relating hexagram flips changing lines (6 → yang, 9 → yin); it is `null` when no lines change. The number is looked up from the lower and upper trigrams with the King Wen table.

- [ ] **Step 1: Write the failing test**

`packages/divination/src/iching.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Rng } from './types.js';
import { castIChing } from './iching.js';
import { HEXAGRAMS, getHexagram, hexagramLines, hexagramNumber } from './data/hexagrams.js';
import { seededRng } from './rng.js';

const scripted = (values: number[]): Rng => { let i = 0; return () => values[i++]!; };

describe('hexagram lookup', () => {
  it('maps all 64 line patterns to 64 distinct numbers and back', () => {
    const seen = new Set<number>();
    for (let v = 0; v < 64; v++) {
      const bits = Array.from({ length: 6 }, (_, i) => ((v >> i) & 1) as 0 | 1);
      const n = hexagramNumber(bits);
      seen.add(n);
      expect(hexagramLines(n)).toEqual(bits);
    }
    expect(seen.size).toBe(64);
  });
  it.each([
    [[1, 1, 1, 1, 1, 1], 1], [[0, 0, 0, 0, 0, 0], 2],
    [[1, 0, 0, 0, 1, 0], 3],   // Water over Thunder
    [[1, 1, 1, 0, 0, 0], 11],  // Earth over Heaven
    [[0, 0, 0, 1, 1, 1], 12],  // Heaven over Earth
    [[0, 0, 0, 0, 0, 1], 23],  // Mountain over Earth
    [[1, 0, 1, 0, 1, 0], 63],  // Water over Fire
    [[0, 1, 0, 1, 0, 1], 64],  // Fire over Water
  ] as [(0 | 1)[], number][])('%j → %i', (bits, n) => { expect(hexagramNumber(bits)).toBe(n); });
  it('has names and keywords for all 64', () => {
    expect(HEXAGRAMS).toHaveLength(64);
    HEXAGRAMS.forEach((h, i) => { expect(h.number).toBe(i + 1); expect(h.keywords.length).toBe(3); });
    expect(getHexagram(1).name).toBe('The Creative');
    expect(getHexagram(64).name).toBe('Before Completion');
  });
});

describe('castIChing', () => {
  it('all heads → six old yang lines: The Creative changing to The Receptive', () => {
    expect(castIChing(scripted(Array(18).fill(1)))).toEqual({
      lines: [9, 9, 9, 9, 9, 9], primary: 1, changingLines: [1, 2, 3, 4, 5, 6], relating: 2,
    });
  });
  it('two tails one head on every line → young yin, no relating hexagram', () => {
    expect(castIChing(scripted(Array(6).fill([0, 0, 1]).flat()))).toEqual({
      lines: [8, 8, 8, 8, 8, 8], primary: 2, changingLines: [], relating: null,
    });
  });
  it('produces valid, deterministic casts', () => {
    for (let s = 0; s < 100; s++) {
      const d = castIChing(seededRng(s));
      expect(d).toEqual(castIChing(seededRng(s)));
      expect(d.lines.every((l) => l >= 6 && l <= 9)).toBe(true);
      expect(d.changingLines).toEqual(d.lines.flatMap((l, i) => (l === 6 || l === 9 ? [i + 1] : [])));
      expect(d.relating === null).toBe(d.changingLines.length === 0);
    }
  });
});
```

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL — cannot resolve `./iching.js`.

- [ ] **Step 2: Hexagram data and lookup**

`packages/divination/src/data/hexagrams.ts`:
```ts
export interface Hexagram { number: number; name: string; pinyin: string; keywords: string[] }

type Bit = 0 | 1;
// Trigrams as bottom → top line strings (1 = yang).
const TRIGRAMS = ['111', '100', '010', '001', '000', '011', '101', '110'] as const;
//                 Qian   Zhen   Kan    Gen    Kun    Xun    Li     Dui
//                 Heaven Thunder Water Mountain Earth Wind  Fire   Lake

/** KING_WEN[lower][upper], both indexed in TRIGRAMS order. */
const KING_WEN: number[][] = [
  [1, 34, 5, 26, 11, 9, 14, 43],
  [25, 51, 3, 27, 24, 42, 21, 17],
  [6, 40, 29, 4, 7, 59, 64, 47],
  [33, 62, 39, 52, 15, 53, 56, 31],
  [12, 16, 8, 23, 2, 20, 35, 45],
  [44, 32, 48, 18, 46, 57, 50, 28],
  [13, 55, 63, 22, 36, 37, 30, 49],
  [10, 54, 60, 41, 19, 61, 38, 58],
];

/** bits: six lines bottom → top, 1 = yang. */
export function hexagramNumber(bits: Bit[]): number {
  if (bits.length !== 6) throw new RangeError('A hexagram has six lines');
  const lower = TRIGRAMS.indexOf(bits.slice(0, 3).join('') as (typeof TRIGRAMS)[number]);
  const upper = TRIGRAMS.indexOf(bits.slice(3).join('') as (typeof TRIGRAMS)[number]);
  return KING_WEN[lower]![upper]!;
}

export function hexagramLines(n: number): Bit[] {
  for (let lower = 0; lower < 8; lower++) {
    const upper = KING_WEN[lower]!.indexOf(n);
    if (upper !== -1) return [...TRIGRAMS[lower]!, ...TRIGRAMS[upper]!].map((c) => Number(c) as Bit);
  }
  throw new RangeError(`No hexagram ${n}`);
}

const H: [string, string, string[]][] = [
  ['The Creative', 'Qián', ['creative power', 'initiative', 'persistence']],
  ['The Receptive', 'Kūn', ['receptivity', 'devotion', 'yielding strength']],
  ['Difficulty at the Beginning', 'Zhūn', ['initial chaos', 'perseverance', 'gathering support']],
  ['Youthful Folly', 'Méng', ['inexperience', 'learning', 'seeking a teacher']],
  ['Waiting', 'Xū', ['patience', 'nourishment', 'right timing']],
  ['Conflict', 'Sòng', ['dispute', 'caution', 'seeking mediation']],
  ['The Army', 'Shī', ['discipline', 'organisation', 'leadership']],
  ['Holding Together', 'Bǐ', ['union', 'alliance', 'loyalty']],
  ['Small Taming', 'Xiǎo Chù', ['gentle restraint', 'small gains', 'patience']],
  ['Treading', 'Lǚ', ['careful conduct', 'propriety', 'treading lightly']],
  ['Peace', 'Tài', ['harmony', 'prosperity', 'flow']],
  ['Standstill', 'Pǐ', ['stagnation', 'withdrawal', 'integrity']],
  ['Fellowship', 'Tóng Rén', ['community', 'shared purpose', 'openness']],
  ['Great Possession', 'Dà Yǒu', ['abundance', 'generosity', 'stewardship']],
  ['Modesty', 'Qiān', ['humility', 'balance', 'quiet strength']],
  ['Enthusiasm', 'Yù', ['inspiration', 'momentum', 'readiness']],
  ['Following', 'Suí', ['adaptation', 'following', 'timing']],
  ['Work on What Has Been Spoiled', 'Gǔ', ['repair', 'correcting the past', 'renewal']],
  ['Approach', 'Lín', ['advance', 'opportunity', 'goodwill']],
  ['Contemplation', 'Guān', ['observation', 'perspective', 'example']],
  ['Biting Through', 'Shì Kè', ['decisiveness', 'justice', 'removing obstacles']],
  ['Grace', 'Bì', ['beauty', 'form', 'elegance']],
  ['Splitting Apart', 'Bō', ['decay', 'letting go', 'waiting it out']],
  ['Return', 'Fù', ['turning point', 'recovery', 'new cycle']],
  ['Innocence', 'Wú Wàng', ['sincerity', 'spontaneity', 'the unexpected']],
  ['Great Taming', 'Dà Chù', ['restraint', 'accumulated strength', 'study']],
  ['Nourishment', 'Yí', ['nourishment', 'care', 'what you take in']],
  ['Great Exceeding', 'Dà Guò', ['excess', 'pressure', 'bold action']],
  ['The Abysmal', 'Kǎn', ['danger', 'repetition', 'courage in difficulty']],
  ['The Clinging', 'Lí', ['clarity', 'dependence', 'illumination']],
  ['Influence', 'Xián', ['attraction', 'mutual influence', 'receptivity']],
  ['Duration', 'Héng', ['endurance', 'consistency', 'commitment']],
  ['Retreat', 'Dùn', ['strategic withdrawal', 'conserving strength', 'timing']],
  ['Great Power', 'Dà Zhuàng', ['strength', 'righteous action', 'restraint']],
  ['Progress', 'Jìn', ['advancement', 'recognition', 'rising']],
  ['Darkening of the Light', 'Míng Yí', ['adversity', 'hidden light', 'perseverance']],
  ['The Family', 'Jiā Rén', ['family', 'roles', 'loyalty']],
  ['Opposition', 'Kuí', ['divergence', 'misunderstanding', 'small matters']],
  ['Obstruction', 'Jiǎn', ['obstacles', 'reflection', 'seeking help']],
  ['Deliverance', 'Xiè', ['release', 'relief', 'forgiveness']],
  ['Decrease', 'Sǔn', ['simplifying', 'sacrifice', 'restraint']],
  ['Increase', 'Yì', ['growth', 'benefit', 'generosity']],
  ['Breakthrough', 'Guài', ['resolution', 'determination', 'speaking truth']],
  ['Coming to Meet', 'Gòu', ['temptation', 'unexpected encounter', 'caution']],
  ['Gathering Together', 'Cuì', ['assembly', 'community', 'shared purpose']],
  ['Pushing Upward', 'Shēng', ['gradual ascent', 'effort', 'growth']],
  ['Oppression', 'Kùn', ['exhaustion', 'adversity', 'inner resolve']],
  ['The Well', 'Jǐng', ['source', 'renewal', 'shared resources']],
  ['Revolution', 'Gé', ['transformation', 'shedding the old', 'timing']],
  ['The Cauldron', 'Dǐng', ['nourishment', 'culture', 'transformation']],
  ['The Arousing', 'Zhèn', ['shock', 'awakening', 'composure']],
  ['Keeping Still', 'Gèn', ['stillness', 'meditation', 'boundaries']],
  ['Development', 'Jiàn', ['gradual progress', 'patience', 'steady growth']],
  ['The Marrying Maiden', 'Guī Mèi', ['subordinate role', 'impulse', 'propriety']],
  ['Abundance', 'Fēng', ['peak', 'fullness', 'making the most of now']],
  ['The Wanderer', 'Lǚ', ['travel', 'transience', 'caution']],
  ['The Gentle', 'Xùn', ['gentle penetration', 'persistence', 'influence']],
  ['The Joyous', 'Duì', ['joy', 'openness', 'exchange']],
  ['Dispersion', 'Huàn', ['dissolution', 'release', 'reuniting']],
  ['Limitation', 'Jié', ['boundaries', 'moderation', 'structure']],
  ['Inner Truth', 'Zhōng Fú', ['sincerity', 'trust', 'inner truth']],
  ['Small Exceeding', 'Xiǎo Guò', ['attention to detail', 'humility', 'small steps']],
  ['After Completion', 'Jì Jì', ['completion', 'vigilance', 'order']],
  ['Before Completion', 'Wèi Jì', ['almost there', 'transition', 'care']],
];

export const HEXAGRAMS: Hexagram[] = H.map(([name, pinyin, keywords], i) => ({ number: i + 1, name, pinyin, keywords }));

export function getHexagram(n: number): Hexagram {
  const h = HEXAGRAMS[n - 1];
  if (!h) throw new RangeError(`No hexagram ${n}`);
  return h;
}
```

- [ ] **Step 3: Implement the cast**

`packages/divination/src/iching.ts`:
```ts
import type { IChingData, Rng } from './types.js';
import { hexagramNumber } from './data/hexagrams.js';

type Line = 6 | 7 | 8 | 9;
const coin = (rng: Rng) => (rng(2) === 1 ? 3 : 2);

export function castIChing(rng: Rng): IChingData {
  const lines = Array.from({ length: 6 }, () => (coin(rng) + coin(rng) + coin(rng)) as Line);
  const isYang = (l: Line) => (l === 7 || l === 9 ? 1 : 0);
  const changingLines = lines.flatMap((l, i) => (l === 6 || l === 9 ? [i + 1] : []));
  const primary = hexagramNumber(lines.map(isYang));
  const relating = changingLines.length
    ? hexagramNumber(lines.map((l) => (l === 6 ? 1 : l === 9 ? 0 : isYang(l))))
    : null;
  return { lines, primary, changingLines, relating };
}
```

Add to `index.ts`:
```ts
export * from './data/hexagrams.js';
export * from './iching.js';
```

- [ ] **Step 4: Run tests, commit**

Run: `pnpm --filter @third-eye/divination test`
Expected: PASS.

```bash
git add -A
git commit -m "feat(divination): i ching three-coin cast with king wen lookup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: `castAll` and `describeResult`

**Files:**
- Create: `packages/divination/src/cast.ts`, `packages/divination/src/describe.ts`
- Modify: `packages/divination/src/index.ts`
- Test: `packages/divination/src/cast.test.ts`, `packages/divination/src/describe.test.ts`

**Interfaces:**
- Produces: `castAll(profile: Profile, rng: Rng): MethodResult[]` and `describeResult(r: MethodResult): ResultDescription`.
- `describeResult` output is used verbatim as prompt material (Task 13) and as the fallback text under each symbol in the UI (Task 21), so keep the wording plain and factual.

- [ ] **Step 1: Write the failing tests**

`packages/divination/src/cast.test.ts`:
```ts
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
```

`packages/divination/src/describe.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { describeResult } from './describe.js';

describe('describeResult', () => {
  it('describes a tarot spread with positions, orientation and keywords', () => {
    const d = describeResult({ method: 'TAROT', data: { cards: [
      { id: 'major-16', reversed: true, position: 'situation' },
      { id: 'cups-01', reversed: false, position: 'challenge' },
      { id: 'swords-12', reversed: false, position: 'advice' },
    ] } });
    expect(d.title).toBe('Tarot');
    expect(d.facts[0]).toBe('Situation: The Tower (reversed) — averted disaster, delayed change, fear of collapse');
    expect(d.facts[1]).toBe('Challenge: Ace of Cups (upright) — new love, compassion, emotional beginning');
  });
  it('describes an I Ching cast with changing lines and relating hexagram', () => {
    const d = describeResult({ method: 'ICHING', data: { lines: [9, 9, 9, 9, 9, 9], primary: 1, changingLines: [1, 2, 3, 4, 5, 6], relating: 2 } });
    expect(d.facts).toEqual([
      'Primary hexagram 1: The Creative (Qián) — creative power, initiative, persistence',
      'Changing lines: 1, 2, 3, 4, 5, 6',
      'Relating hexagram 2: The Receptive (Kūn) — receptivity, devotion, yielding strength',
    ]);
  });
  it('describes the birth-based methods', () => {
    expect(describeResult({ method: 'WESTERN', data: { sign: 'gemini' } }).facts[0])
      .toBe('Sun sign Gemini ♊ — Air, Mutable, ruled by Mercury — curious, adaptable, restless');
    expect(describeResult({ method: 'CHINESE', data: { animal: 'horse', element: 'metal', polarity: 'yang', lunarYear: 1990 } }).facts[0])
      .toBe('Metal Horse (yang), lunar year 1990 — Horse: free-spirited, energetic, impatient; Metal: determination, discipline, clarity');
    expect(describeResult({ method: 'NUMEROLOGY', data: { lifePath: 11, expression: null } }).facts)
      .toEqual(['Life Path 11 (master number): The Intuitive — insight, inspiration, sensitivity']);
    expect(describeResult({ method: 'BLOODTYPE', data: { type: 'AB' } }).facts[0])
      .toBe('Blood type AB: The Enigmatic Dreamer — rational, adaptable, dual-natured, imaginative');
    expect(describeResult({ method: 'RUNE', data: { id: 'ansuz', reversed: false } }).facts[0])
      .toBe('Ansuz ᚨ (upright) — communication, wisdom, divine message');
  });
});
```

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL — cannot resolve `./cast.js` / `./describe.js`.

- [ ] **Step 2: Implement `castAll`**

`packages/divination/src/cast.ts`:
```ts
import type { MethodResult, Profile, Rng } from './types.js';
import { castTarot } from './tarot.js';
import { castRune } from './runes.js';
import { castIChing } from './iching.js';
import { castWestern } from './western.js';
import { castChinese } from './chinese.js';
import { castNumerology } from './numerology.js';
import { castBloodType } from './bloodtype.js';

/** Draws and computes every method the profile supports, in METHODS order. */
export function castAll(profile: Profile, rng: Rng): MethodResult[] {
  const out: MethodResult[] = [
    { method: 'TAROT', data: castTarot(rng) },
    { method: 'RUNE', data: castRune(rng) },
    { method: 'ICHING', data: castIChing(rng) },
    { method: 'WESTERN', data: castWestern(profile) },
    { method: 'CHINESE', data: castChinese(profile) },
    { method: 'NUMEROLOGY', data: castNumerology(profile) },
  ];
  const blood = castBloodType(profile);
  if (blood) out.push({ method: 'BLOODTYPE', data: blood });
  return out;
}
```

- [ ] **Step 3: Implement `describeResult`**

`packages/divination/src/describe.ts`:
```ts
import type { MethodResult, ResultDescription } from './types.js';
import { METHOD_LABELS } from './types.js';
import { getTarotCard } from './data/tarot.js';
import { getRune } from './data/runes.js';
import { getHexagram } from './data/hexagrams.js';
import { getZodiacSign } from './data/zodiac.js';
import { getChineseAnimal, getChineseElement } from './data/chinese.js';
import { getNumberMeaning } from './data/numbers.js';
import { BLOOD_TYPES } from './data/blood-types.js';

const list = (xs: string[]) => xs.join(', ');
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const orient = (reversed: boolean) => (reversed ? 'reversed' : 'upright');

function numberFact(label: string, n: number): string {
  const m = getNumberMeaning(n);
  return `${label} ${n}${m.master ? ' (master number)' : ''}: ${m.title} — ${list(m.keywords)}`;
}

export function describeResult(r: MethodResult): ResultDescription {
  const title = METHOD_LABELS[r.method];
  switch (r.method) {
    case 'TAROT':
      return { method: r.method, title, facts: r.data.cards.map((c) => {
        const card = getTarotCard(c.id);
        return `${cap(c.position)}: ${card.name} (${orient(c.reversed)}) — ${list(c.reversed ? card.reversed : card.upright)}`;
      }) };
    case 'RUNE': {
      const rune = getRune(r.data.id);
      const words = r.data.reversed && rune.reversedMeaning ? rune.reversedMeaning : rune.meaning;
      return { method: r.method, title, facts: [`${rune.name} ${rune.glyph} (${orient(r.data.reversed)}) — ${list(words)}`] };
    }
    case 'ICHING': {
      const hex = (label: string, n: number) => {
        const h = getHexagram(n);
        return `${label} hexagram ${n}: ${h.name} (${h.pinyin}) — ${list(h.keywords)}`;
      };
      const facts = [hex('Primary', r.data.primary)];
      if (r.data.changingLines.length) facts.push(`Changing lines: ${r.data.changingLines.join(', ')}`);
      if (r.data.relating !== null) facts.push(hex('Relating', r.data.relating));
      return { method: r.method, title, facts };
    }
    case 'WESTERN': {
      const s = getZodiacSign(r.data.sign);
      return { method: r.method, title, facts: [
        `Sun sign ${s.name} ${s.glyph} — ${s.element}, ${s.modality}, ruled by ${s.ruler} — ${list(s.traits)}`,
      ] };
    }
    case 'CHINESE': {
      const a = getChineseAnimal(r.data.animal);
      const e = getChineseElement(r.data.element);
      return { method: r.method, title, facts: [
        `${e.name} ${a.name} (${r.data.polarity}), lunar year ${r.data.lunarYear} — ${a.name}: ${list(a.traits)}; ${e.name}: ${list(e.traits)}`,
      ] };
    }
    case 'NUMEROLOGY': {
      const facts = [numberFact('Life Path', r.data.lifePath)];
      if (r.data.expression !== null) facts.push(numberFact('Expression', r.data.expression));
      return { method: r.method, title, facts };
    }
    case 'BLOODTYPE': {
      const b = BLOOD_TYPES[r.data.type];
      return { method: r.method, title, facts: [`Blood type ${r.data.type}: ${b.title} — ${list(b.traits)}`] };
    }
  }
}
```

Final `packages/divination/src/index.ts`:
```ts
export * from './types.js';
export * from './rng.js';
export * from './data/zodiac.js';
export * from './western.js';
export * from './data/lunar-new-year.js';
export * from './data/chinese.js';
export * from './chinese.js';
export * from './data/numbers.js';
export * from './numerology.js';
export * from './data/blood-types.js';
export * from './bloodtype.js';
export * from './data/tarot.js';
export * from './tarot.js';
export * from './data/runes.js';
export * from './runes.js';
export * from './data/hexagrams.js';
export * from './iching.js';
export * from './cast.js';
export * from './describe.js';
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `pnpm --filter @third-eye/divination test; pnpm typecheck; pnpm lint`
Expected: all PASS / exit 0.

Also confirm purity: `grep -rnE "Math\.random|Date\.now|new Date\(\)|from 'node:" packages/divination/src` → no output.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(divination): castAll and human-readable result descriptions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
