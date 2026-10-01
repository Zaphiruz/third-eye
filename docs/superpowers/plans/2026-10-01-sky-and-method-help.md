# Today's Sky & Method Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an eighth method, "The Sky" (moon phase plus where the Sun, Moon and planets stand today), and a help explainer on every method card that links to a public `/how-it-works` page.

**Architecture:** `packages/divination` computes `SkyData` with `astronomy-engine`. Code that pulls in astronomy-engine (`sky.ts`, `cast.ts`) is exported only from a new `@third-eye/divination/cast` subpath, so the frontend bundle never includes it. The backend casts SKY for local noon on the fortune's date and stores it like any other result. `packages/ui` draws it (`SkyChart`, `MoonGlyph`) and adds a JavaScript-free `<details>` explainer to `MethodCard`. The backend server-renders `/how-it-works` with the same `Page` layout and inlined CSS as share pages.

**Tech Stack:** existing stack (pnpm monorepo, Fastify 5, Prisma 5, React 18, Tailwind 3, Vitest 2) plus `astronomy-engine` ^2.1.19.

**Spec:** `docs/superpowers/specs/2026-09-30-sky-and-method-help-design.md`. Read it first.

## Global Constraints

- Branch `sky-and-help` (already checked out). Repo `D:\code\third-eye`, Windows + Git Bash, pnpm 10, Node ≥ 20. Dev Postgres runs in Docker on `localhost:5435` (`docker compose up -d postgres`); backend tests use the `third_eye_test` database.
- Commit trailer, exactly: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Relative imports in `packages/*` and `apps/backend` use `.js` extensions (NodeNext). The frontend's own files use extensionless imports, as they do today.
- `packages/divination` stays pure: no I/O, no `Math.random`, no `Date.now()`. `castSky` receives the instant to compute for.
- `METHODS` order, exactly: `['TAROT','RUNE','ICHING','SKY','WESTERN','CHINESE','NUMEROLOGY','BLOODTYPE']`. `METHOD_LABELS.SKY = 'The Sky'`.
- SKY is **not** in `BIRTH_SIGN_METHODS`, so it is always shown on share pages.
- Sky bodies in fixed order: `sun, moon, mercury, venus, mars, jupiter, saturn`. Glyphs: `☉︎ ☽︎ ☿︎ ♀︎ ♂︎ ♃︎ ♄︎` (each followed by U+FE0E). Retrograde mark `℞`.
- Moon phase buckets by elongation E (degrees): new `E < 22.5 or E ≥ 337.5`; waxing-crescent `< 67.5`; first-quarter `< 112.5`; waxing-gibbous `< 157.5`; full `< 202.5`; waning-gibbous `< 247.5`; last-quarter `< 292.5`; waning-crescent otherwise. Illumination = `(1 − cos E) / 2`, rounded to 2 decimals. Waxing = `E < 180`.
- No real Anthropic calls in tests. Never print secrets.
- `/how-it-works` headers: the share-page headers (`SHARE_PAGE_HEADERS`) with `cache-control` replaced by `public, max-age=3600`. It keeps `x-robots-tag: noindex` and must contain no `<script>`.
- Existing fortunes are not backfilled.

## File Structure

```
packages/divination/
  package.json                (+ astronomy-engine, + "./cast" export)
  src/types.ts                (SkyBody, MoonPhase, SkyData, SKY in METHODS/labels/MethodResult)
  src/data/sky.ts             NEW  SKY_BODY_IDS, SKY_BODIES, MOON_PHASE_NAMES (no astronomy-engine import)
  src/data/method-info.ts     NEW  METHOD_INFO
  src/sky.ts  sky.test.ts     NEW  castSky, eclipticLongitude, moonPhaseFor
  src/cast-entry.ts           NEW  subpath entry: castAll + castSky
  src/cast.ts cast.test.ts    castAll(profile, rng, ctx)
  src/describe.ts describe.test.ts  SKY facts
  src/index.ts                drops cast.js, adds data/sky.js + data/method-info.js
packages/ui/src/
  symbols/MoonGlyph.tsx  symbols/SkyChart.tsx  symbols/sky.test.tsx   NEW
  MethodCard.tsx  MethodCard.test.tsx (NEW)  index.ts  ssr.test.tsx
apps/backend/
  package.json (+ astronomy-engine for bundling)   tsup.config.ts
  prisma/schema.prisma  prisma/migrations/20261001120000_sky_method/migration.sql
  src/lib/dates.ts dates.test.ts            localNoonUtc
  src/fortunes/service.ts service.test.ts   SKY at local noon
  src/oracle/prompt.ts prompt.test.ts       PROMPT_VERSION, rule line
  src/test/helpers/db.ts                    seedFortune passes skyAt
  src/shares/page.tsx page.test.ts          export Page/doc; SKY on share pages
  src/help/content.tsx page.tsx routes.ts routes.test.ts   NEW
  src/app.ts  tailwind.share.config.ts
apps/frontend/
  src/ritual/steps.tsx steps.test.tsx   src/pages/Settings.tsx Settings.test.tsx  Welcome.tsx  App.test.tsx
  src/sw.ts  vite.config.ts  Caddyfile
README.md  OPERATIONS.md
```

---

### Task 1: `castSky` in `packages/divination`

**Files:**
- Modify: `packages/divination/package.json`, `packages/divination/src/types.ts`, `packages/divination/src/index.ts`
- Create: `packages/divination/src/data/sky.ts`, `packages/divination/src/sky.ts`, `packages/divination/src/sky.test.ts`

**Interfaces:**
- Produces (types, from `@third-eye/divination`): `SkyBody`, `MoonPhase`, `SkyBodyPosition`, `SkyData` (shapes below).
- Produces (data, from `@third-eye/divination`): `SKY_BODY_IDS: readonly SkyBody[]`, `SKY_BODIES: Record<SkyBody, { id: SkyBody; name: string; glyph: string }>`, `MOON_PHASE_NAMES: Record<MoonPhase, string>` (title case, e.g. `'Waxing Gibbous'`, `'New Moon'`).
- Produces (from `src/sky.ts`; **not** exported from `index.ts`): `castSky(at: Date): SkyData`, `eclipticLongitude(body: SkyBody, at: Date): number`, `moonPhaseFor(elongation: number): MoonPhase`.

- [ ] **Step 1: Add the dependency**

```bash
pnpm --filter @third-eye/divination add astronomy-engine@^2.1.19
```

- [ ] **Step 2: Add the types** to `packages/divination/src/types.ts`, after `BloodTypeData`. Do **not** touch `METHODS` or `MethodResult` yet; Task 3 does that.

```ts
export type SkyBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
export type MoonPhase =
  | 'new' | 'waxing-crescent' | 'first-quarter' | 'waxing-gibbous'
  | 'full' | 'waning-gibbous' | 'last-quarter' | 'waning-crescent';
/** Tropical zodiac position; degree is 0–29 within the sign. Sun and Moon are never retrograde. */
export interface SkyBodyPosition { body: SkyBody; sign: ZodiacSignId; degree: number; retrograde: boolean }
/** illumination is a 0–1 fraction (2 decimals); bodies are in SKY_BODY_IDS order. */
export interface SkyData { moon: { phase: MoonPhase; illumination: number; waxing: boolean }; bodies: SkyBodyPosition[] }
```

- [ ] **Step 3: Create the reference data** `packages/divination/src/data/sky.ts`. It must not import astronomy-engine, because the UI and frontend import this file.

```ts
import type { MoonPhase, SkyBody } from '../types.js';

export const SKY_BODY_IDS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const satisfies readonly SkyBody[];

// U+FE0E asks for the text (not emoji) presentation of each glyph.
export const SKY_BODIES: Record<SkyBody, { id: SkyBody; name: string; glyph: string }> = {
  sun: { id: 'sun', name: 'Sun', glyph: '☉\uFE0E' },
  moon: { id: 'moon', name: 'Moon', glyph: '☽\uFE0E' },
  mercury: { id: 'mercury', name: 'Mercury', glyph: '☿\uFE0E' },
  venus: { id: 'venus', name: 'Venus', glyph: '♀\uFE0E' },
  mars: { id: 'mars', name: 'Mars', glyph: '♂\uFE0E' },
  jupiter: { id: 'jupiter', name: 'Jupiter', glyph: '♃\uFE0E' },
  saturn: { id: 'saturn', name: 'Saturn', glyph: '♄\uFE0E' },
};

export const MOON_PHASE_NAMES: Record<MoonPhase, string> = {
  'new': 'New Moon', 'waxing-crescent': 'Waxing Crescent', 'first-quarter': 'First Quarter',
  'waxing-gibbous': 'Waxing Gibbous', 'full': 'Full Moon', 'waning-gibbous': 'Waning Gibbous',
  'last-quarter': 'Last Quarter', 'waning-crescent': 'Waning Crescent',
};
```

Add `export * from './data/sky.js';` to `packages/divination/src/index.ts`, after the `data/hexagrams.js` line.

- [ ] **Step 4: Write the failing tests** `packages/divination/src/sky.test.ts`. The expected values were checked against astronomy-engine 2.1.19.

```ts
import { describe, expect, it } from 'vitest';
import { castSky, moonPhaseFor } from './sky.js';
import { sunSign } from './western.js';
import type { SkyData } from './types.js';

const at = (iso: string) => new Date(iso);

describe('castSky', () => {
  it('places every body at the reference instant 2026-09-30T12:00Z', () => {
    const expected: SkyData = {
      moon: { phase: 'waning-gibbous', illumination: 0.83, waxing: false },
      bodies: [
        { body: 'sun', sign: 'libra', degree: 7, retrograde: false },
        { body: 'moon', sign: 'taurus', degree: 26, retrograde: false },
        { body: 'mercury', sign: 'scorpio', degree: 0, retrograde: false },
        { body: 'venus', sign: 'scorpio', degree: 8, retrograde: false },
        { body: 'mars', sign: 'leo', degree: 1, retrograde: false },
        { body: 'jupiter', sign: 'leo', degree: 19, retrograde: false },
        { body: 'saturn', sign: 'aries', degree: 11, retrograde: true },
      ],
    };
    expect(castSky(at('2026-09-30T12:00:00Z'))).toEqual(expected);
  });

  it('sees the full moon of 2026-09-26 (16:49Z)', () => {
    const { moon } = castSky(at('2026-09-26T17:00:00Z'));
    expect(moon.phase).toBe('full');
    expect(moon.illumination).toBeGreaterThanOrEqual(0.98);
  });

  it('sees the new moon of 2026-10-10 (15:50Z)', () => {
    const { moon } = castSky(at('2026-10-10T15:50:00Z'));
    expect(moon.phase).toBe('new');
    expect(moon.illumination).toBeLessThanOrEqual(0.02);
  });

  it('sees the first quarter of 2026-09-18 (20:44Z)', () => {
    const { moon } = castSky(at('2026-09-18T20:44:00Z'));
    expect(moon.phase).toBe('first-quarter');
    expect(moon.illumination).toBeGreaterThanOrEqual(0.45);
    expect(moon.illumination).toBeLessThanOrEqual(0.55);
    expect(moon.waxing).toBe(true);
  });

  it('flags Mercury retrograde (2026-10-24 … 2026-11-14) and not before it', () => {
    const mercury = (iso: string) => castSky(at(iso)).bodies.find((b) => b.body === 'mercury')!;
    expect(mercury('2026-11-01T12:00:00Z').retrograde).toBe(true);
    expect(mercury('2026-10-15T12:00:00Z').retrograde).toBe(false);
  });

  it('puts the Sun in the conventional sun sign for mid-sign dates', () => {
    for (let m = 1; m <= 12; m++) {
      const date = `2026-${String(m).padStart(2, '0')}-05`;
      expect(castSky(at(`${date}T12:00:00Z`)).bodies[0]!.sign, date).toBe(sunSign(date));
    }
  });

  it('never marks the Sun or Moon retrograde, and keeps degrees whole numbers in 0–29', () => {
    for (let d = 0; d < 60; d++) {
      const sky = castSky(new Date(Date.UTC(2026, 0, 1 + d, 12)));
      expect(sky.bodies.map((b) => b.body)).toEqual(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);
      expect(sky.bodies[0]!.retrograde).toBe(false);
      expect(sky.bodies[1]!.retrograde).toBe(false);
      for (const b of sky.bodies) {
        expect(Number.isInteger(b.degree)).toBe(true);
        expect(b.degree).toBeGreaterThanOrEqual(0);
        expect(b.degree).toBeLessThanOrEqual(29);
      }
    }
  });
});

describe('moonPhaseFor', () => {
  it.each([
    [0, 'new'], [22.4, 'new'], [22.5, 'waxing-crescent'], [67.5, 'first-quarter'], [90, 'first-quarter'],
    [112.5, 'waxing-gibbous'], [157.5, 'full'], [180, 'full'], [202.5, 'waning-gibbous'],
    [247.5, 'last-quarter'], [270, 'last-quarter'], [292.5, 'waning-crescent'], [337.4, 'waning-crescent'], [337.5, 'new'],
  ] as const)('elongation %s° is %s', (e, phase) => {
    expect(moonPhaseFor(e)).toBe(phase);
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm --filter @third-eye/divination test -- sky`
Expected: FAIL (cannot resolve `./sky.js`).

- [ ] **Step 6: Implement** `packages/divination/src/sky.ts`

```ts
import { Body, Ecliptic, EclipticGeoMoon, GeoVector, MakeTime, SunPosition } from 'astronomy-engine';
import type { MoonPhase, SkyBody, SkyBodyPosition, SkyData } from './types.js';
import { SKY_BODY_IDS } from './data/sky.js';
import { ZODIAC_SIGNS } from './data/zodiac.js';

const DAY_MS = 86_400_000;
const PLANETS: Partial<Record<SkyBody, Body>> = {
  mercury: Body.Mercury, venus: Body.Venus, mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn,
};
const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** Geocentric apparent ecliptic longitude (of date) in degrees, [0, 360). */
export function eclipticLongitude(body: SkyBody, at: Date): number {
  const t = MakeTime(at);
  if (body === 'sun') return norm(SunPosition(t).elon);
  if (body === 'moon') return norm(EclipticGeoMoon(t).lon);
  return norm(Ecliptic(GeoVector(PLANETS[body]!, t, true)).elon);
}

// Eight phases, each centred on its principal angle (new 0°, first quarter 90°, full 180°, last quarter 270°).
const PHASES: MoonPhase[] = [
  'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full', 'waning-gibbous', 'last-quarter', 'waning-crescent',
];
/** Moon–Sun elongation in degrees → phase name. */
export function moonPhaseFor(elongation: number): MoonPhase {
  return PHASES[Math.floor(norm(elongation + 22.5) / 45) % 8]!;
}

/** Where the Sun, Moon and planets stand at `at`, in the tropical zodiac, plus the moon phase. */
export function castSky(at: Date): SkyData {
  const next = new Date(at.getTime() + DAY_MS);
  const lon = Object.fromEntries(SKY_BODY_IDS.map((b) => [b, eclipticLongitude(b, at)])) as Record<SkyBody, number>;
  const bodies = SKY_BODY_IDS.map((body): SkyBodyPosition => {
    const l = lon[body];
    let retrograde = false;
    if (PLANETS[body]) {
      let delta = eclipticLongitude(body, next) - l; // unwrap across 0°/360°
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      retrograde = delta < 0;
    }
    return { body, sign: ZODIAC_SIGNS[Math.floor(l / 30)]!.id, degree: Math.floor(l % 30), retrograde };
  });
  const e = norm(lon.moon - lon.sun);
  return {
    moon: { phase: moonPhaseFor(e), illumination: Math.round(((1 - Math.cos((e * Math.PI) / 180)) / 2) * 100) / 100, waxing: e < 180 },
    bodies,
  };
}
```

(`ZODIAC_SIGNS` is ordered Aries → Pisces, which matches 30° slices from 0° longitude.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @third-eye/divination test && pnpm --filter @third-eye/divination typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/divination pnpm-lock.yaml
git commit -m "feat(divination): castSky — planet positions, retrogrades and moon phase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `localNoonUtc` (backend)

**Files:**
- Modify: `apps/backend/src/lib/dates.ts`, `apps/backend/src/lib/dates.test.ts`

**Interfaces:**
- Produces: `localNoonUtc(date: string, timeZone: string): Date`, the UTC instant at which the wall clock in `timeZone` shows 12:00 on `date` (YYYY-MM-DD).

- [ ] **Step 1: Write the failing tests.** Append to `apps/backend/src/lib/dates.test.ts` and add `localNoonUtc` to its import.

```ts
describe('localNoonUtc', () => {
  it.each([
    ['2026-09-30', 'UTC', '2026-09-30T12:00:00.000Z'],
    ['2026-09-30', 'America/Chicago', '2026-09-30T17:00:00.000Z'],      // CDT, UTC−5
    ['2026-09-30', 'Asia/Tokyo', '2026-09-30T03:00:00.000Z'],
    ['2026-09-30', 'Asia/Kolkata', '2026-09-30T06:30:00.000Z'],
    ['2026-09-30', 'Pacific/Kiritimati', '2026-09-29T22:00:00.000Z'],   // UTC+14
    ['2026-03-08', 'America/New_York', '2026-03-08T16:00:00.000Z'],     // DST starts 02:00 that morning
    ['2026-11-01', 'America/New_York', '2026-11-01T17:00:00.000Z'],     // DST ended 02:00 that morning
    ['2026-03-29', 'Europe/London', '2026-03-29T11:00:00.000Z'],        // BST starts 01:00 that morning
  ])('%s in %s → %s', (date, tz, iso) => {
    expect(localNoonUtc(date, tz).toISOString()).toBe(iso);
  });

  it('falls on the same local date', () => {
    for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Los_Angeles']) {
      expect(localDate(localNoonUtc('2026-09-30', tz), tz)).toBe('2026-09-30');
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @third-eye/backend exec vitest run src/lib/dates.test.ts`
Expected: FAIL (`localNoonUtc` is not exported).

- [ ] **Step 3: Implement.** Append to `apps/backend/src/lib/dates.ts`:

```ts
/** How far `timeZone`'s wall clock is ahead of UTC at `at`, in ms. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant the clock in `timeZone` reads 12:00 on `date` (YYYY-MM-DD). The SKY method is cast for it. */
export function localNoonUtc(date: string, timeZone: string): Date {
  const noonAsUtc = Date.parse(`${date}T12:00:00Z`);
  // Two passes: the second uses the offset in force at (approximately) local noon, which handles DST days.
  const first = noonAsUtc - zoneOffsetMs(new Date(noonAsUtc), timeZone);
  return new Date(noonAsUtc - zoneOffsetMs(new Date(first), timeZone));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @third-eye/backend exec vitest run src/lib/dates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/dates.ts apps/backend/src/lib/dates.test.ts
git commit -m "feat(backend): localNoonUtc helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: SKY becomes a method end to end

**Files:**
- Modify: `packages/divination/src/types.ts`, `cast.ts`, `cast.test.ts`, `describe.ts`, `describe.test.ts`, `index.ts`, `package.json`
- Create: `packages/divination/src/cast-entry.ts`
- Modify: `apps/backend/prisma/schema.prisma`; Create: `apps/backend/prisma/migrations/20261001120000_sky_method/migration.sql`
- Modify: `apps/backend/package.json`, `apps/backend/tsup.config.ts`, `apps/backend/src/fortunes/service.ts`, `service.test.ts`, `apps/backend/src/oracle/prompt.ts`, `prompt.test.ts`, `apps/backend/src/test/helpers/db.ts`, `apps/backend/src/shares/page.test.ts`

**Interfaces:**
- Consumes: `castSky`, `SkyData`, `SKY_BODIES`, `MOON_PHASE_NAMES` (Task 1); `localNoonUtc` (Task 2).
- Produces: `METHODS` including `'SKY'`; `MethodResult` member `{ method: 'SKY'; data: SkyData }`; `METHOD_LABELS.SKY = 'The Sky'`.
- Produces: `castAll(profile: Profile, rng: Rng, ctx: CastContext): MethodResult[]` with `interface CastContext { skyAt: Date }`, imported from **`@third-eye/divination/cast`** (it is removed from the main entry). That subpath also exports `castSky`.
- Produces: `describeResult` for SKY (exact strings below). `PROMPT_VERSION = '2026-10-01.1'`.

- [ ] **Step 1: Widen the types** in `packages/divination/src/types.ts`:

```ts
export const METHODS = ['TAROT', 'RUNE', 'ICHING', 'SKY', 'WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE'] as const;
```
```ts
export const METHOD_LABELS: Record<Method, string> = {
  TAROT: 'Tarot', RUNE: 'Rune', ICHING: 'I Ching', SKY: 'The Sky', WESTERN: 'Sun Sign',
  CHINESE: 'Chinese Zodiac', NUMEROLOGY: 'Numerology', BLOODTYPE: 'Blood Type',
};
```
Add `| { method: 'SKY'; data: SkyData }` to `MethodResult`, after the `ICHING` member.

- [ ] **Step 2: Write the failing divination tests.** Replace `packages/divination/src/cast.test.ts` with:

```ts
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
```

Add to `packages/divination/src/describe.test.ts`, inside the `describe('describeResult', …)` block:

```ts
  it('describes the sky: moon first, then each body, then the retrograde summary', () => {
    const data = {
      moon: { phase: 'waning-gibbous' as const, illumination: 0.83, waxing: false },
      bodies: [
        { body: 'sun' as const, sign: 'libra' as const, degree: 7, retrograde: false },
        { body: 'moon' as const, sign: 'taurus' as const, degree: 26, retrograde: false },
        { body: 'mercury' as const, sign: 'scorpio' as const, degree: 0, retrograde: true },
        { body: 'venus' as const, sign: 'scorpio' as const, degree: 8, retrograde: false },
        { body: 'mars' as const, sign: 'leo' as const, degree: 1, retrograde: false },
        { body: 'jupiter' as const, sign: 'leo' as const, degree: 19, retrograde: false },
        { body: 'saturn' as const, sign: 'aries' as const, degree: 11, retrograde: true },
      ],
    };
    const d = describeResult({ method: 'SKY', data });
    expect(d.title).toBe('The Sky');
    expect(d.facts).toEqual([
      'Moon: waning gibbous, 83% lit, in Taurus 26°',
      'Sun in Libra 7°',
      'Mercury in Scorpio 0° (retrograde)',
      'Venus in Scorpio 8°',
      'Mars in Leo 1°',
      'Jupiter in Leo 19°',
      'Saturn in Aries 11° (retrograde)',
      'Retrograde today: Mercury, Saturn',
    ]);
    const direct = { ...data, bodies: data.bodies.map((b) => ({ ...b, retrograde: false })) };
    expect(describeResult({ method: 'SKY', data: direct }).facts.at(-1)).toBe('No planets retrograde today');
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @third-eye/divination test`
Expected: FAIL. castAll does not produce SKY, and describeResult has no SKY case (a typecheck error and a test failure).

- [ ] **Step 4: Implement `castAll` and the subpath entry.** Replace `packages/divination/src/cast.ts`:

```ts
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
```

Create `packages/divination/src/cast-entry.ts`:

```ts
// `@third-eye/divination/cast`: everything that pulls in astronomy-engine. Kept off the main entry so the
// frontend bundle (which only displays results) never includes it.
export { castAll, type CastContext } from './cast.js';
export { castSky, eclipticLongitude, moonPhaseFor } from './sky.js';
```

In `packages/divination/src/index.ts`, **delete** the line `export * from './cast.js';`. In `packages/divination/package.json`, set:

```json
"exports": { ".": "./src/index.ts", "./cast": "./src/cast-entry.ts" },
```

- [ ] **Step 5: Implement the SKY description.** In `packages/divination/src/describe.ts`, add imports and a case:

```ts
import { MOON_PHASE_NAMES, SKY_BODIES } from './data/sky.js';
```
```ts
    case 'SKY': {
      const { moon, bodies } = r.data;
      const at = (b: (typeof bodies)[number]) => `${getZodiacSign(b.sign).name} ${b.degree}°`;
      const moonPos = bodies.find((b) => b.body === 'moon')!;
      const retro = bodies.filter((b) => b.retrograde).map((b) => SKY_BODIES[b.body].name);
      return { method: r.method, title, facts: [
        `Moon: ${MOON_PHASE_NAMES[moon.phase].toLowerCase()}, ${Math.round(moon.illumination * 100)}% lit, in ${at(moonPos)}`,
        ...bodies.filter((b) => b.body !== 'moon')
          .map((b) => `${SKY_BODIES[b.body].name} in ${at(b)}${b.retrograde ? ' (retrograde)' : ''}`),
        retro.length ? `Retrograde today: ${list(retro)}` : 'No planets retrograde today',
      ] };
    }
```

- [ ] **Step 6: Run the divination tests**

Run: `pnpm --filter @third-eye/divination test && pnpm --filter @third-eye/divination typecheck`
Expected: PASS.

- [ ] **Step 7: Prisma enum and migration.** In `apps/backend/prisma/schema.prisma`, add `SKY` after `ICHING` in `enum Method`. Create `apps/backend/prisma/migrations/20261001120000_sky_method/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "Method" ADD VALUE 'SKY' AFTER 'ICHING';
```

Then run:

```bash
pnpm --filter @third-eye/backend exec prisma generate
pnpm --filter @third-eye/backend prisma migrate deploy
pnpm --filter @third-eye/backend test:db:setup
```
(the first applies the migration to the dev DB, the second to `third_eye_test`; Postgres must be running).

- [ ] **Step 8: Bundle astronomy-engine into the backend build.** The production image runs `apps/backend/dist/server.js`, which can only resolve packages that are reachable from `apps/backend`. Add the dependency and bundle it, along with the new subpath:

```bash
pnpm --filter @third-eye/backend add astronomy-engine@^2.1.19
```

`apps/backend/tsup.config.ts`:

```ts
  noExternal: [/^@third-eye\//, 'astronomy-engine'],
```

- [ ] **Step 9: Update the backend callers and write the failing backend tests.**

`apps/backend/src/test/helpers/db.ts`: import `castAll` from `'@third-eye/divination/cast'` (keep `seededRng` from `'@third-eye/divination'`), and cast the sky for UTC noon of the seeded date:

```ts
  const date = opts.date ?? '2026-09-26';
  const results = castAll(profile, seededRng(opts.seed ?? 1), { skyAt: new Date(`${date}T12:00:00Z`) });
```
(Also use `date` in the existing `date: new Date(\`${…}T00:00:00.000Z\`)` line.)

`apps/backend/src/oracle/prompt.test.ts`: import `castAll` from `'@third-eye/divination/cast'` and pass `{ skyAt: new Date('2026-09-26T12:00:00Z') }` as the third argument. Add to `describe('buildPrompt', …)`:

```ts
  it("includes today's sky", () => {
    expect(req.user).toContain('[SKY] The Sky');
    expect(req.user).toMatch(/- Moon: [a-z ]+, \d+% lit, in [A-Z][a-z]+ \d+°/);
    expect(req.system).toContain('The Sky is where the Moon and planets stand today');
  });
```

`apps/backend/src/fortunes/service.test.ts`: import `castAll, castSky` from `'@third-eye/divination/cast'` (keep `seededRng` from `'@third-eye/divination'`). In "creates a pending fortune with real draws…", change the method list to include `'SKY'` after `'ICHING'`, and the expected draws to:

```ts
    const expected = castAll({ birthDate: '1990-06-15', fullName: null, bloodType: 'A' }, seededRng(11), { skyAt: new Date('2026-09-26T12:00:00Z') });
```

Add a test:

```ts
  it("casts the sky for noon on the fortune's date in the user's time zone", async () => {
    now = new Date('2026-09-26T20:00:00Z');                  // 13:00 PDT on 2026-09-26
    await makeUser('la', { timeZone: 'America/Los_Angeles' });
    const { fortune } = await service().today('la');
    expect(fortune.date).toBe('2026-09-26');
    expect(fortune.results.find((r) => r.method === 'SKY')!.data).toEqual(castSky(new Date('2026-09-26T19:00:00Z')));
  });
```

`apps/backend/src/shares/page.test.ts`: in "hides birth-based methods unless the share includes them", add after the `not.toContain('Blood Type')` line:

```ts
    expect(hidden.body).toContain('The Sky');
```

- [ ] **Step 10: Run them to verify they fail**

Run: `pnpm --filter @third-eye/backend test`
Expected: FAIL. The service still calls `castAll` without a ctx and has no SKY, and the prompt has no sky rule. Typecheck errors also count as failure.

- [ ] **Step 11: Implement the backend side.**

`apps/backend/src/fortunes/service.ts`:

```ts
import type { Rng } from '@third-eye/divination';
import { castAll } from '@third-eye/divination/cast';
import { fromDbDate, localDate, localNoonUtc, toDbDate } from '../lib/dates.js';
```
```ts
      const results = castAll(profile, deps.rng, { skyAt: localNoonUtc(date, user.timeZone) });
```

`apps/backend/src/oracle/prompt.ts`: set `export const PROMPT_VERSION = '2026-10-01.1';`, and insert into `RULES` right after the "Use them faithfully" line:

```ts
  "The Sky is where the Moon and planets stand today for everyone — not the reader's birth chart. Treat it as the day's weather and relate it to the reader's own results.",
```

Run `grep -rn "castAll" apps packages --include=*.ts --include=*.tsx | grep -v node_modules`. Every import of `castAll` must now come from `'@third-eye/divination/cast'`.

- [ ] **Step 12: Run everything**

Run: `pnpm --filter @third-eye/backend test && pnpm typecheck && pnpm lint`
Expected: PASS. (`packages/ui` and the frontend still typecheck because SKY falls through to the default `MethodSymbol` case for now.)

Then confirm the build bundles astronomy-engine:

```bash
pnpm --filter @third-eye/backend build
grep -c "from \"astronomy-engine\"\|require(\"astronomy-engine\")" apps/backend/dist/server.js
```
Expected: build succeeds, and grep prints `0` (no external import is left).

- [ ] **Step 13: Commit**

```bash
git add packages/divination apps/backend pnpm-lock.yaml
git commit -m "feat: The Sky method — cast at local noon, stored, described to the oracle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `METHOD_INFO` explainer data

**Files:**
- Create: `packages/divination/src/data/method-info.ts`, `packages/divination/src/data/method-info.test.ts`
- Modify: `packages/divination/src/index.ts`

**Interfaces:**
- Produces: `interface MethodInfo { summary: string; learnMoreUrl: string; learnMoreLabel: string }` and `METHOD_INFO: Record<Method, MethodInfo>`, both exported from `@third-eye/divination`.

- [ ] **Step 1: Write the failing test** `packages/divination/src/data/method-info.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { METHOD_INFO } from './method-info.js';
import { METHODS } from '../types.js';

describe('METHOD_INFO', () => {
  it('explains every method with a short summary and an https link', () => {
    expect(Object.keys(METHOD_INFO).sort()).toEqual([...METHODS].sort());
    for (const m of METHODS) {
      const info = METHOD_INFO[m];
      expect(info.summary.length, m).toBeGreaterThan(80);
      expect(info.summary.length, m).toBeLessThan(420);
      expect(new URL(info.learnMoreUrl).protocol, m).toBe('https:');
      expect(info.learnMoreLabel.length, m).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @third-eye/divination test -- method-info`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `packages/divination/src/data/method-info.ts`

```ts
import type { Method } from '../types.js';

export interface MethodInfo { summary: string; learnMoreUrl: string; learnMoreLabel: string }

/** The short "ⓘ" explainer on each method card. The long form lives on /how-it-works. */
export const METHOD_INFO: Record<Method, MethodInfo> = {
  TAROT: {
    summary: 'Tarot began as a 15th-century Italian card game and became a tool for divination in 18th-century France. Third Eye shuffles all 78 cards and lays three — your situation, your challenge and advice — each upright or reversed.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Tarot_card_reading', learnMoreLabel: 'Tarot card reading',
  },
  RUNE: {
    summary: 'The Elder Futhark is the oldest runic alphabet, used by Germanic peoples from about the 2nd century. Third Eye draws one of its 24 runes; most can land reversed ("merkstave"), which turns their meaning toward its shadow.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Elder_Futhark', learnMoreLabel: 'Elder Futhark',
  },
  ICHING: {
    summary: 'The I Ching, or Book of Changes, is a Chinese classic over 2,500 years old. Third Eye tosses three coins six times to build a hexagram from the bottom up; changing lines flip to show where things are heading.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/I_Ching_divination', learnMoreLabel: 'I Ching divination',
  },
  SKY: {
    summary: 'Astrologers have watched the Moon and the five naked-eye planets for thousands of years. Third Eye calculates where the Sun, Moon and planets stand in the zodiac at noon on the day of your reading, the moon phase, and which planets appear to move backwards (retrograde).',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Lunar_phase', learnMoreLabel: 'Lunar phase',
  },
  WESTERN: {
    summary: 'Western astrology divides the year into twelve signs of the tropical zodiac. Your sun sign is the sign the Sun was in on your birth date; each has an element, a modality and a ruling planet.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Astrological_sign', learnMoreLabel: 'Astrological sign',
  },
  CHINESE: {
    summary: 'The Chinese zodiac pairs twelve animals with five elements and yin or yang, in a 60-year cycle. Third Eye finds your animal from the Lunar New Year of your birth year, so early-year birthdays may belong to the year before.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Chinese_zodiac', learnMoreLabel: 'Chinese zodiac',
  },
  NUMEROLOGY: {
    summary: 'Numerology gives meaning to numbers reduced from your birth date and name, in a tradition credited to Pythagoras. Your Life Path comes from your birth date; your Expression number, if you gave a full name, from its letters.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Numerology', learnMoreLabel: 'Numerology',
  },
  BLOODTYPE: {
    summary: 'Blood type personality (ketsueki-gata) is a popular belief in Japan and Korea that your ABO blood type shapes your temperament. It has no scientific support; Third Eye includes it for fun, only if you add your blood type.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Blood_type_personality_theory', learnMoreLabel: 'Blood type personality theory',
  },
};
```

Add `export * from './data/method-info.js';` to `packages/divination/src/index.ts`, after the `data/sky.js` line.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @third-eye/divination test && pnpm --filter @third-eye/divination typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/divination/src/data/method-info.ts packages/divination/src/data/method-info.test.ts packages/divination/src/index.ts
git commit -m "feat(divination): METHOD_INFO explainers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sky visuals in `packages/ui`

**Files:**
- Create: `packages/ui/src/symbols/MoonGlyph.tsx`, `packages/ui/src/symbols/SkyChart.tsx`, `packages/ui/src/symbols/sky.test.tsx`
- Modify: `packages/ui/src/MethodCard.tsx`, `packages/ui/src/index.ts`, `packages/ui/src/ssr.test.tsx`

**Interfaces:**
- Consumes: `SkyData`, `SKY_BODIES`, `MOON_PHASE_NAMES`, `getZodiacSign` from `@third-eye/divination`.
- Produces: `MoonGlyph({ illumination: number; waxing: boolean; size?: number; label?: string; className?: string })`. With `label` it is `role="img"` + `aria-label`; without, `aria-hidden`. The root `<svg>` carries `data-lit="right" | "left"`.
- Produces: `SkyChart({ data: SkyData; revealed?: number; className?: string })`. `revealed` = how many body rows are visible (default: all), used by the ritual. Each row is an `<li data-body="<id>">`.
- Both exported from `@third-eye/ui`.

- [ ] **Step 1: Write the failing tests** `packages/ui/src/symbols/sky.test.tsx`

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SkyData } from '@third-eye/divination';
import { MoonGlyph } from './MoonGlyph.js';
import { SkyChart } from './SkyChart.js';
import { MethodCard, MiniSymbols } from '../MethodCard.js';

const SKY: SkyData = {
  moon: { phase: 'waning-gibbous', illumination: 0.83, waxing: false },
  bodies: [
    { body: 'sun', sign: 'libra', degree: 7, retrograde: false },
    { body: 'moon', sign: 'taurus', degree: 26, retrograde: false },
    { body: 'mercury', sign: 'scorpio', degree: 0, retrograde: false },
    { body: 'venus', sign: 'scorpio', degree: 8, retrograde: false },
    { body: 'mars', sign: 'leo', degree: 1, retrograde: false },
    { body: 'jupiter', sign: 'leo', degree: 19, retrograde: false },
    { body: 'saturn', sign: 'aries', degree: 11, retrograde: true },
  ],
};

describe('MoonGlyph', () => {
  it('lights the right side while waxing and the left while waning', () => {
    const { container } = render(<><MoonGlyph illumination={0.3} waxing /><MoonGlyph illumination={0.3} waxing={false} /></>);
    const svgs = container.querySelectorAll('svg');
    expect(svgs[0]!.getAttribute('data-lit')).toBe('right');
    expect(svgs[1]!.getAttribute('data-lit')).toBe('left');
    expect(svgs[0]!.getAttribute('aria-hidden')).toBe('true');
  });
  it('is labelled when given a label', () => {
    render(<MoonGlyph illumination={1} waxing label="Moon: full moon, 100% lit" />);
    expect(screen.getByRole('img', { name: 'Moon: full moon, 100% lit' })).toBeInTheDocument();
  });
});

describe('SkyChart', () => {
  it('shows the moon, its phase and a row per body with the retrograde mark', () => {
    const { container } = render(<SkyChart data={SKY} />);
    expect(screen.getByRole('img', { name: 'Moon: waning gibbous, 83% lit' })).toBeInTheDocument();
    expect(screen.getByText('Waning Gibbous · 83% lit')).toBeInTheDocument();
    const rows = container.querySelectorAll('li[data-body]');
    expect(Array.from(rows).map((r) => r.getAttribute('data-body'))).toEqual(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);
    expect(rows[6]!.textContent).toContain('Saturn');
    expect(rows[6]!.textContent).toContain('11°');
    expect(rows[6]!.textContent).toContain('Aries');
    expect(rows[6]!.textContent).toContain('℞');
    expect(rows[6]!.textContent).toContain('retrograde');
    expect(rows[0]!.textContent).not.toContain('℞');
  });
  it('reveals rows one at a time for the ritual', () => {
    const { container } = render(<SkyChart data={SKY} revealed={2} />);
    expect(container.querySelectorAll('li[data-body].opacity-100')).toHaveLength(2);
  });
  it('is drawn by MethodCard for SKY, and adds a moon to MiniSymbols', () => {
    render(<MethodCard result={{ method: 'SKY', data: SKY, reading: 'Look up.' }} />);
    expect(screen.getByRole('heading', { name: 'The Sky' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Moon: waning gibbous, 83% lit' })).toBeInTheDocument();
    expect(screen.getByText('Saturn in Aries 11° (retrograde)')).toBeInTheDocument();
    const { container } = render(<MiniSymbols results={[{ method: 'SKY', data: SKY, reading: null }]} />);
    expect(container.querySelector('svg[data-lit="left"]')).toBeTruthy();
  });
});
```

Add the SKY result to the `fortune.results` fixture in `packages/ui/src/ssr.test.tsx` (after ICHING), importing nothing new; write it inline:

```ts
    { method: 'SKY', data: { moon: { phase: 'full', illumination: 1, waxing: false }, bodies: [
      { body: 'sun', sign: 'libra', degree: 3, retrograde: false }, { body: 'moon', sign: 'aries', degree: 3, retrograde: false },
      { body: 'mercury', sign: 'libra', degree: 24, retrograde: false }, { body: 'venus', sign: 'scorpio', degree: 7, retrograde: false },
      { body: 'mars', sign: 'cancer', degree: 29, retrograde: false }, { body: 'jupiter', sign: 'leo', degree: 18, retrograde: false },
      { body: 'saturn', sign: 'aries', degree: 11, retrograde: true },
    ] }, reading: 'Bright.' },
```
and add `expect(html).toContain('Moon: full moon, 100% lit');` to its test.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @third-eye/ui test`
Expected: FAIL (`MoonGlyph.js` / `SkyChart.js` not found).

- [ ] **Step 3: Implement** `packages/ui/src/symbols/MoonGlyph.tsx`

```tsx
/**
 * The moon as seen from the northern hemisphere: lit on the right while waxing, on the left while waning.
 * The lit shape is a limb semicircle closed by the terminator, an ellipse whose x-radius is r·|1 − 2k|.
 */
export function MoonGlyph({ illumination, waxing, size = 64, label, className = '' }: {
  illumination: number; waxing: boolean; size?: number; label?: string; className?: string;
}) {
  const c = 50, r = 44;
  const k = Math.min(1, Math.max(0, illumination));
  const rx = Math.abs(1 - 2 * k) * r;
  // Lit on the right: top → (limb, clockwise via the right) → bottom → (terminator) → top.
  // A crescent's terminator bows toward the lit side (sweep 0); a gibbous one bows away (sweep 1).
  const lit = `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${k > 0.5 ? 1 : 0} ${c} ${c - r} Z`;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} data-lit={waxing ? 'right' : 'left'} className={className} {...a11y}>
      <circle cx={c} cy={c} r={r} fill="#1e1b4b" stroke="#d4af37" strokeOpacity="0.4" strokeWidth="1.5" />
      <path d={lit} fill="#e9d8a6" transform={waxing ? undefined : `translate(${2 * c} 0) scale(-1 1)`}
        filter="drop-shadow(0 0 4px rgba(233,216,166,0.45))" />
    </svg>
  );
}
```

`packages/ui/src/symbols/SkyChart.tsx`

```tsx
import { getZodiacSign, MOON_PHASE_NAMES, SKY_BODIES, type SkyData } from '@third-eye/divination';
import { MoonGlyph } from './MoonGlyph.js';

export function SkyChart({ data, revealed, className = '' }: { data: SkyData; revealed?: number; className?: string }) {
  const shown = revealed ?? data.bodies.length;
  const pct = Math.round(data.moon.illumination * 100);
  const phase = MOON_PHASE_NAMES[data.moon.phase];
  return (
    <div className={`grid w-full max-w-xs justify-items-center gap-3 ${className}`}>
      <MoonGlyph illumination={data.moon.illumination} waxing={data.moon.waxing} size={88}
        label={`Moon: ${phase.toLowerCase()}, ${pct}% lit`} />
      <p className="text-sm text-mist/80">{phase} · {pct}% lit</p>
      <ul className="grid w-full gap-1 text-sm">
        {data.bodies.map((b, i) => {
          const body = SKY_BODIES[b.body];
          const sign = getZodiacSign(b.sign);
          return (
            <li key={b.body} data-body={b.body}
              className={`flex items-center gap-2 transition-opacity duration-500 ${i < shown ? 'opacity-100' : 'opacity-0'}`}>
              <span aria-hidden className="w-6 text-center font-display text-lg text-gold">{body.glyph}</span>
              <span className="flex-1">{body.name}</span>
              <span className="text-mist/80">{b.degree}° <span aria-hidden>{sign.glyph}</span> {sign.name}</span>
              {b.retrograde && <span className="text-gold"><span aria-hidden>℞</span><span className="sr-only">retrograde</span></span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Wire them into `MethodCard.tsx`.** Add `type SkyData` to the `@third-eye/divination` import, import `MoonGlyph` and `SkyChart`, and add a case before `default` in `MethodSymbol`:

```tsx
    case 'SKY':
      return <SkyChart data={result.data as SkyData} />;
```

In `MiniSymbols`, keep the glyph string and append a small moon:

```tsx
export function MiniSymbols({ results }: { results: FortuneResultDto[] }) {
  const glyphs: string[] = [];
  let sky: SkyData | null = null;
  for (const r of results) {
    if (r.method === 'RUNE') glyphs.push(getRune((r.data as RuneData).id).glyph);
    if (r.method === 'ICHING') glyphs.push(String.fromCodePoint(0x4dc0 + (r.data as IChingData).primary - 1));
    if (r.method === 'SKY') sky = r.data as SkyData;
    if (r.method === 'WESTERN') glyphs.push(getZodiacSign((r.data as WesternData).sign).glyph);
  }
  return (
    <span aria-hidden className="inline-flex items-center gap-2 font-display text-xl tracking-widest text-gold/80">
      {glyphs.join(' ')}
      {sky && <MoonGlyph illumination={sky.moon.illumination} waxing={sky.moon.waxing} size={20} />}
    </span>
  );
}
```

Add to `packages/ui/src/index.ts`:

```ts
export { MoonGlyph } from './symbols/MoonGlyph.js';
export { SkyChart } from './symbols/SkyChart.js';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @third-eye/ui test && pnpm --filter @third-eye/ui typecheck && pnpm --filter @third-eye/frontend test`
Expected: PASS. (The History tests render `MiniSymbols`; existing assertions on glyph text still hold.)

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): SkyChart and MoonGlyph for The Sky

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: "ⓘ" explainer on every method card

**Files:**
- Modify: `packages/ui/src/MethodCard.tsx`
- Create: `packages/ui/src/MethodCard.test.tsx`

**Interfaces:**
- Consumes: `METHOD_INFO`, `type Method` from `@third-eye/divination` (Task 4).
- Produces: inside every `MethodCard`, a `<details>` whose `<summary>` has `aria-label="About <label>"` and text `ⓘ`. It contains the summary text, a link "How Third Eye does this" → `/how-it-works#<method lowercase>`, and a link "Learn more ↗" → `learnMoreUrl` with `target="_blank" rel="noopener noreferrer"`.

- [ ] **Step 1: Write the failing test** `packages/ui/src/MethodCard.test.tsx`

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { METHOD_INFO } from '@third-eye/divination';
import { MethodCard } from './MethodCard.js';

describe('MethodCard explainer', () => {
  it('offers a no-JS "About" disclosure with the summary and both links', () => {
    const { container } = render(<MethodCard result={{ method: 'ICHING', data: { lines: [7, 7, 7, 8, 8, 8], primary: 11, changingLines: [], relating: null }, reading: 'Peace.' }} />);
    const summary = container.querySelector('details > summary')!;
    expect(summary.getAttribute('aria-label')).toBe('About I Ching');
    expect(summary.textContent).toBe('ⓘ');
    expect(screen.getByText(METHOD_INFO.ICHING.summary)).toBeInTheDocument();
    const how = screen.getByRole('link', { name: 'How Third Eye does this', hidden: true });
    expect(how.getAttribute('href')).toBe('/how-it-works#iching');
    const more = screen.getByRole('link', { name: /Learn more/, hidden: true });
    expect(more.getAttribute('href')).toBe(METHOD_INFO.ICHING.learnMoreUrl);
    expect(more.getAttribute('target')).toBe('_blank');
    expect(more.getAttribute('rel')).toBe('noopener noreferrer');
    expect(more.getAttribute('title')).toBe(`${METHOD_INFO.ICHING.learnMoreLabel} on Wikipedia`);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @third-eye/ui test -- MethodCard`
Expected: FAIL (no `details > summary`).

- [ ] **Step 3: Implement.** In `packages/ui/src/MethodCard.tsx`, add `METHOD_INFO, type Method` to the divination import, add the component, and replace the `<h3>` line in `MethodCard`:

```tsx
const linkClass = 'text-gold underline-offset-2 hover:underline';

/** A plain <details> so it works on the JavaScript-free share pages too. */
function MethodHelp({ method, label }: { method: Method; label: string }) {
  const info = METHOD_INFO[method];
  return (
    <details>
      <summary aria-label={`About ${label}`}
        className="absolute right-0 top-0 flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-gold/40 text-gold/80 hover:text-gold [&::-webkit-details-marker]:hidden">ⓘ</summary>
      <div className="mt-2 grid gap-2 rounded-lg bg-veil/40 p-3 text-sm text-mist/80">
        <p>{info.summary}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a className={linkClass} href={`/how-it-works#${method.toLowerCase()}`}>How Third Eye does this</a>
          <a className={linkClass} href={info.learnMoreUrl} target="_blank" rel="noopener noreferrer"
            title={`${info.learnMoreLabel} on Wikipedia`}>Learn more ↗</a>
        </p>
      </div>
    </details>
  );
}
```
```tsx
      <header className="relative">
        <h3 className="pr-10 text-2xl">{desc.title}</h3>
        <MethodHelp method={result.method} label={desc.title} />
      </header>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @third-eye/ui test && pnpm --filter @third-eye/ui typecheck && pnpm --filter @third-eye/frontend test && pnpm --filter @third-eye/backend test`
Expected: PASS. (The share-page tests still pass, and `<details>` adds no `<script>`.)

- [ ] **Step 5: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): about-this-method explainer on every card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Public `/how-it-works` page (backend)

**Files:**
- Modify: `apps/backend/src/shares/page.tsx` (export `Page` and `doc`), `apps/backend/tailwind.share.config.ts`, `apps/backend/src/app.ts`
- Create: `apps/backend/src/help/content.tsx`, `apps/backend/src/help/page.tsx`, `apps/backend/src/help/routes.ts`, `apps/backend/src/help/routes.test.ts`

**Interfaces:**
- Consumes: `METHOD_INFO`, `METHODS`, `METHOD_LABELS`, `type Method` (`@third-eye/divination`); `SHARE_PAGE_HEADERS` (`../shares/public-routes.js`); `Page`, `doc` (`../shares/page.js`).
- Produces: `HELP_PAGE_HEADERS`, `registerHelpRoutes(app: FastifyInstance): void`, `renderHowItWorksPage(): string`. Each method section has `id="<method lowercase>"`.

- [ ] **Step 1: Write the failing test** `apps/backend/src/help/routes.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { METHOD_INFO, METHODS } from '@third-eye/divination';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });

describe('GET /how-it-works', () => {
  it('is a public, cacheable, script-free page', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/how-it-works' });   // no session cookie
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(r.headers['cache-control']).toBe('public, max-age=3600');
    expect(r.headers['x-robots-tag']).toBe('noindex');
    expect(r.headers['referrer-policy']).toBe('no-referrer');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['content-security-policy']).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(r.body.startsWith('<!doctype html>')).toBe(true);
    expect(r.body).not.toMatch(/<script/i);
    expect(r.body).toContain('<title>How readings work — Third Eye</title>');
  });

  it('explains how a reading is made, what is shared, and every method', async () => {
    const html = (await ctx.app.inject({ method: 'GET', url: '/how-it-works' })).body;
    expect(html).toContain('id="how"');
    expect(html).toContain('id="privacy"');
    for (const m of METHODS) {
      expect(html, m).toContain(`id="${m.toLowerCase()}"`);
      expect(html, m).toContain(`href="${METHOD_INFO[m].learnMoreUrl}"`);
    }
    expect(html).toContain('For reflection and entertainment');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @third-eye/backend exec vitest run src/help/routes.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Export the layout.** In `apps/backend/src/shares/page.tsx`, change `function Page(` to `export function Page(` and `const doc =` to `export const doc =`. Add `'./src/help/**/*.tsx'` to `content` in `apps/backend/tailwind.share.config.ts`:

```ts
  content: ['../../packages/ui/src/**/*.{ts,tsx}', './src/shares/**/*.tsx', './src/help/**/*.tsx'],
```

- [ ] **Step 4: Write the long-form content** `apps/backend/src/help/content.tsx`

```tsx
import type { ReactNode } from 'react';
import type { Method } from '@third-eye/divination';

/** The long-form explanation of each method on /how-it-works. Short summaries live in METHOD_INFO. */
export const METHOD_GUIDES: Record<Method, ReactNode> = {
  TAROT: <>
    <p>Tarot decks appeared in northern Italy in the 1400s as playing cards. Reading them for meaning became popular in France in the late 1700s. The modern deck has 78 cards: 22 Major Arcana (The Fool, The Tower, The Star…) for life's big themes, and 56 Minor Arcana in four suits — Wands (drive), Cups (feeling), Swords (thought) and Pentacles (the material world).</p>
    <p><strong>How Third Eye draws:</strong> the whole deck is shuffled with cryptographic randomness and three cards are laid out — <em>Situation</em> (where you stand), <em>Challenge</em> (what pushes back) and <em>Advice</em> (how to meet it). Each card has an even chance of landing reversed.</p>
    <p><strong>Reading it:</strong> a reversed card is not "bad". It points to the same energy blocked, turned inward or arriving late.</p>
  </>,
  RUNE: <>
    <p>The Elder Futhark is the oldest runic alphabet, carved by Germanic peoples from about the 2nd to the 8th century. Each of its 24 runes is a sound and a word — Fehu (cattle, wealth), Ansuz (a god, the voice), Raidho (the journey). Casting runes for guidance is mostly a 20th-century revival, inspired by the Roman historian Tacitus.</p>
    <p><strong>How Third Eye draws:</strong> one rune is chosen at random from the 24. Runes that look the same upside down, such as Gebo and Isa, are always upright. Every other rune has an even chance of being <em>merkstave</em> (reversed).</p>
    <p><strong>Reading it:</strong> merkstave turns a rune's meaning toward its shadow side — wealth becomes loss, a message becomes misunderstanding.</p>
  </>,
  ICHING: <>
    <p>The I Ching, or Book of Changes, dates from China's Zhou dynasty, roughly 3,000 years ago. Confucian scholars later added commentaries to it. It describes 64 hexagrams, each a stack of six solid (yang) or broken (yin) lines.</p>
    <p><strong>How Third Eye casts:</strong> the three-coin method. For each line, three virtual coins are tossed (heads count 3, tails 2), giving 6, 7, 8 or 9. Lines are built from the bottom up: 7 is a steady yang line, 8 a steady yin line, and 9 and 6 are yang and yin lines that are <em>changing</em>.</p>
    <p><strong>Reading it:</strong> the first hexagram is the present. Changing lines flip to their opposite, giving a second, <em>relating</em> hexagram that shows where the situation is heading.</p>
  </>,
  SKY: <>
    <p>Astrologers from Babylon to Alexandria tracked the seven "wandering stars" visible to the naked eye — the Sun, the Moon, Mercury, Venus, Mars, Jupiter and Saturn — as they move through the twelve signs of the zodiac. The Moon's phases have marked time for almost every culture.</p>
    <p><strong>How Third Eye calculates it:</strong> no randomness here. Using the astronomy-engine library, Third Eye computes where each body appears from Earth, against the tropical zodiac, at <em>noon on the day of your reading in your time zone</em>, along with the Moon's phase and how much of it is lit. A planet is marked <em>retrograde</em> (℞) when it appears to be moving backwards — an illusion caused by Earth passing it, or it passing Earth.</p>
    <p><strong>Reading it:</strong> this is the same sky for everyone that day, not your birth chart. Think of it as the day's weather: a waxing Moon builds, a full Moon peaks, a waning Moon releases, and a new Moon begins. A retrograde planet is traditionally a time to review its area of life — Mercury for communication, Venus for love, Mars for drive — rather than start something new.</p>
  </>,
  WESTERN: <>
    <p>Western astrology comes from Hellenistic Egypt, where Babylonian sky-watching met Greek philosophy. The tropical zodiac divides the Sun's yearly path into twelve 30° signs, starting at the spring equinox. Each sign has an element (fire, earth, air, water), a modality (cardinal, fixed, mutable) and a ruling planet.</p>
    <p><strong>How Third Eye calculates it:</strong> your sun sign comes from your birth date, using the conventional dates (for example, Gemini runs May 21 – June 20). If you were born on the first or last day of a sign, your exact sign can depend on the year and time.</p>
    <p><strong>Reading it:</strong> your sun sign is your core temperament. The oracle reads today's cards and sky in its light.</p>
  </>,
  CHINESE: <>
    <p>The Chinese zodiac goes back more than 2,000 years. Twelve animals (Rat, Ox, Tiger…) cycle with the five elements (wood, fire, earth, metal, water), each in a yang and a yin year, giving a 60-year cycle.</p>
    <p><strong>How Third Eye calculates it:</strong> the zodiac year starts at Lunar New Year (between January 21 and February 20), not on January 1. Third Eye looks up the exact Lunar New Year date for your birth year in a table covering 1900–2100. If you were born in January or early February, you may belong to the previous year's animal.</p>
    <p><strong>Reading it:</strong> the animal is your character; the element colours how it shows; yin and yang say whether it turns inward or outward.</p>
  </>,
  NUMEROLOGY: <>
    <p>The idea that numbers carry meaning is ancient and is often credited to Pythagoras. Modern "Pythagorean" numerology took shape in the early 20th century.</p>
    <p><strong>How Third Eye calculates it:</strong> for your <em>Life Path</em>, your birth month, day and year are each reduced to one digit by adding their digits, then added together and reduced again. For your <em>Expression</em> number (only if you gave a full name), letters count A=1 … I=9, J=1 … R=9, S=1 … Z=8, and the total is reduced the same way. 11, 22 and 33 are <em>master numbers</em> and are never reduced.</p>
    <p><strong>Reading it:</strong> your Life Path is the road you walk; your Expression is the toolkit you bring to it. Master numbers carry extra intensity.</p>
  </>,
  BLOODTYPE: <>
    <p>Blood type personality (ketsueki-gata) began with a 1927 paper by the Japanese psychologist Takeji Furukawa. It became a pop-culture favourite in Japan and Korea in the 1970s. Studies have found no real link between blood type and personality — it is here for fun and cultural flavour.</p>
    <p><strong>How Third Eye uses it:</strong> only if you add your blood type in Settings. Each type has a classic archetype — A the Careful Planner, B the Free Spirit, O the Confident Leader, AB the Enigmatic Dreamer.</p>
    <p><strong>Reading it:</strong> treat it as a lighthearted lens on how you might meet the day.</p>
  </>,
};
```

- [ ] **Step 5: Write the page** `apps/backend/src/help/page.tsx`

```tsx
import { METHOD_INFO, METHOD_LABELS, METHODS } from '@third-eye/divination';
import { doc, Page } from '../shares/page.js';
import { METHOD_GUIDES } from './content.js';

const link = 'text-gold underline-offset-2 hover:underline';

export function renderHowItWorksPage(): string {
  return doc(
    <Page title="How readings work — Third Eye"
      description="How Third Eye draws, calculates and interprets each daily reading, and what each tradition means.">
      <header className="mb-6 mt-4 text-center">
        <h1 className="text-3xl">How readings work</h1>
        <p className="mt-2 text-sm"><a className={link} href="/">Open Third Eye</a></p>
      </header>
      <div className="grid gap-5 leading-relaxed">
        <section id="how" className="card grid gap-3">
          <h2 className="text-2xl">How a reading is made</h2>
          <p>Once a day, Third Eye draws your tarot cards, rune and I Ching hexagram on the server with cryptographic randomness. The sky, your signs and your numbers are calculated rather than drawn.</p>
          <p>Then the oracle — Claude, an AI by Anthropic — writes your reading in the voice you chose. It sees only those results and must interpret them as they are: it can't change a card, add a rune or move a planet.</p>
          <p>You get one reading per day, dated in your own time zone. Come back tomorrow for the next.</p>
        </section>
        <section id="privacy" className="card grid gap-3">
          <h2 className="text-2xl">What's shared with the AI, and what's stored</h2>
          <p>The oracle receives your results and your first name — nothing else. Your birth date, full name, time zone and email are never sent to it.</p>
          <p>Your readings are stored so History works. A reading is only visible to someone else if you create a share link, and you can stop sharing at any time.</p>
        </section>
        <h2 className="mt-4 text-center text-2xl">The methods</h2>
        {METHODS.map((m) => (
          <section key={m} id={m.toLowerCase()} className="card grid gap-3">
            <h3 className="text-2xl">{METHOD_LABELS[m]}</h3>
            {METHOD_GUIDES[m]}
            <p><a className={link} href={METHOD_INFO[m].learnMoreUrl} target="_blank" rel="noopener noreferrer">{METHOD_INFO[m].learnMoreLabel} on Wikipedia ↗</a></p>
          </section>
        ))}
        <p className="text-center text-mist/70">For reflection and entertainment — not advice.</p>
      </div>
    </Page>,
  );
}
```

(The shared `Page` footer says "for reflection…" in lower case. The test looks for the capitalised sentence above.)

- [ ] **Step 6: Write the route** `apps/backend/src/help/routes.ts`

```ts
import type { FastifyInstance } from 'fastify';
import { SHARE_PAGE_HEADERS } from '../shares/public-routes.js';
import { renderHowItWorksPage } from './page.js';

/** Same lock-down as share pages, but identical for everyone, so it may be cached. */
export const HELP_PAGE_HEADERS = { ...SHARE_PAGE_HEADERS, 'cache-control': 'public, max-age=3600' } as const;

export function registerHelpRoutes(app: FastifyInstance): void {
  const html = renderHowItWorksPage(); // static: render once at startup
  app.get('/how-it-works', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_req, reply) => reply.headers(HELP_PAGE_HEADERS).type('text/html; charset=utf-8').send(html));
}
```

In `apps/backend/src/app.ts`, import `registerHelpRoutes` from `'./help/routes.js'` and call `registerHelpRoutes(app);` right after `registerPublicShareRoutes(app, { shares });`. If the app has an auth/onboarding hook that rejects unauthenticated non-`/api` paths, check how `/s/` is exempted and exempt `/how-it-works` the same way. The test "no session cookie → 200" proves it.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @third-eye/backend test && pnpm --filter @third-eye/backend typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): public How readings work page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend ritual step, links, routing and docs

**Files:**
- Modify: `apps/frontend/src/ritual/steps.tsx`, `steps.test.tsx`, `apps/frontend/src/pages/Settings.tsx`, `Settings.test.tsx`, `apps/frontend/src/pages/Welcome.tsx`, `apps/frontend/src/App.test.tsx`, `apps/frontend/src/sw.ts`, `apps/frontend/vite.config.ts`, `apps/frontend/Caddyfile`, `README.md`, `OPERATIONS.md`

**Interfaces:**
- Consumes: `SkyChart` (`@third-eye/ui`), `type SkyData` (`@third-eye/divination`), the `/how-it-works` route (Task 7).
- Produces: a ritual step with key `'sky'` and caption `'The heavens turn'`, placed right after `'iching'`.

- [ ] **Step 1: Write the failing tests.**

Append to `apps/frontend/src/ritual/steps.test.tsx` (add `screen` to the `@testing-library/react` import and `import type { SkyData } from '@third-eye/divination';`):

```tsx
const sky: SkyData = { moon: { phase: 'full', illumination: 1, waxing: false }, bodies: [
  { body: 'sun', sign: 'libra', degree: 3, retrograde: false }, { body: 'moon', sign: 'aries', degree: 3, retrograde: false },
  { body: 'mercury', sign: 'libra', degree: 24, retrograde: false }, { body: 'venus', sign: 'scorpio', degree: 7, retrograde: false },
  { body: 'mars', sign: 'cancer', degree: 29, retrograde: false }, { body: 'jupiter', sign: 'leo', degree: 18, retrograde: false },
  { body: 'saturn', sign: 'aries', degree: 11, retrograde: true },
] };

describe('sky step', () => {
  const withSky: FortuneDto = { ...fortune, results: [
    ...fortune.results,
    { method: 'ICHING', data: { lines: [7, 7, 7, 8, 8, 8], primary: 11, changingLines: [], relating: null }, reading: null },
    { method: 'SKY', data: sky, reading: null },
  ] };

  it('comes right after the I Ching', () => {
    const steps = buildRitualSteps(withSky, false);
    expect(steps.map((s) => s.key)).toEqual(['tarot', 'iching', 'sky', 'oracle']);
    expect(steps[2]!.caption).toBe('The heavens turn');
  });

  it('shows the moon and lights the bodies one by one', () => {
    const step = buildRitualSteps(withSky, true).find((s) => s.key === 'sky')!;
    const { container } = render(<>{step.render()}</>);
    expect(screen.getByRole('img', { name: 'Moon: full moon, 100% lit' })).toBeInTheDocument();
    // useTicker schedules the next tick only after each re-render, so advance in separate act() calls.
    for (let i = 0; i < 10; i++) act(() => { vi.advanceTimersByTime(100); });
    expect(container.querySelectorAll('li[data-body].opacity-100')).toHaveLength(7);
  });
});
```

Append to the `Settings` describe in `apps/frontend/src/pages/Settings.test.tsx`:

```tsx
  it('links to how readings work', async () => {
    installMockApi({ 'GET /me': ok(me()) });
    renderApp(undefined, { route: '/settings' });
    expect(await screen.findByRole('link', { name: 'How readings work' })).toHaveAttribute('href', '/how-it-works');
  });
```

In `apps/frontend/src/App.test.tsx`, extend the first test ("sends users who have not onboarded…"):

```tsx
    expect(screen.getByRole('link', { name: 'How readings work' })).toHaveAttribute('href', '/how-it-works');
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @third-eye/frontend test`
Expected: FAIL (no sky step, no links).

- [ ] **Step 3: Implement the ritual step** in `apps/frontend/src/ritual/steps.tsx`. Add `SkyChart` to the `@third-eye/ui` import and `type SkyData` to the divination import:

```tsx
function SkyStep({ data, reduced }: { data: SkyData; reduced: boolean }) {
  const shown = useTicker(data.bodies.length, reduced ? 60 : 320);
  return (
    <motion.div className="flex justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0.2 : 0.8 }}>
      <SkyChart data={data} revealed={shown} />
    </motion.div>
  );
}
```

In `buildRitualSteps`, after the `ICHING` push:

```tsx
  if (byMethod.SKY) steps.push({ key: 'sky', caption: 'The heavens turn', duration: d(3200), render: () => <SkyStep data={byMethod.SKY as SkyData} reduced={reduced} /> });
```

- [ ] **Step 4: Add the links.** `apps/frontend/src/pages/Settings.tsx`, between the "Changes apply…" paragraph and the Sign out button:

```tsx
      <a className="text-center text-sm text-gold underline-offset-2 hover:underline" href="/how-it-works">How readings work</a>
```

`apps/frontend/src/pages/Welcome.tsx`, after the intro paragraph:

```tsx
      <p className="mt-2 text-center text-sm">
        <a className="text-gold underline-offset-2 hover:underline" href="/how-it-works">How readings work</a>
      </p>
```

Also update the Welcome intro text to mention the sky: "Each day, Third Eye draws tarot, casts a rune and the I Ching, reads today's sky and your stars and numbers — then an oracle weaves them into one fortune."

(These are plain `<a>`, not router `<Link>`, so the browser does a full navigation to the backend-rendered page.)

- [ ] **Step 5: Route `/how-it-works` to the backend everywhere.**

`apps/frontend/src/sw.ts`, add `/^\/how-it-works/` to the navigation denylist:

```ts
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/s\//, /^\/how-it-works/] }));
```

`apps/frontend/vite.config.ts`, add to `proxy`:

```ts
'/how-it-works': { target: 'http://127.0.0.1:3001', changeOrigin: false },
```

`apps/frontend/Caddyfile`, after the `handle /s/*` block:

```
  # The public "How readings work" page is rendered by the backend, like share pages.
  handle /how-it-works {
    reverse_proxy backend:3000
  }
```

- [ ] **Step 6: Docs.** In `README.md`, change the first paragraph to mention "today's sky (moon phase and planet positions)" alongside the other methods, and add after the share-links paragraph: "Every method card has an ⓘ explainer, and `/how-it-works` (public) explains each tradition and how readings are made." In `OPERATIONS.md`, add after the share-links paragraph: "**How readings work:** `/how-it-works` is a public, static page rendered by the backend (Caddy routes it there), cached for an hour, `noindex`. Its text lives in `apps/backend/src/help/content.tsx` and `packages/divination/src/data/method-info.ts`."

- [ ] **Step 7: Run everything**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm --filter @third-eye/frontend build`
Expected: PASS. Then check that nothing the frontend imports reaches astronomy-engine:

```bash
grep -rln "astronomy-engine\|/sky.js'\|/cast.js'\|divination/cast" packages/divination/src/index.ts packages/divination/src/data packages/ui/src apps/frontend/src
```
Expected: no output. (Only `sky.ts`, `cast.ts` and `cast-entry.ts` import it; the main entry and UI never touch them.)

- [ ] **Step 8: Manual smoke** (dev servers: `pnpm dev`). Log in at `http://localhost:5174/api/auth/dev-login?sub=dev`, delete today's dev fortune if one exists so a new one is cast, and check:
- the ritual shows "The heavens turn";
- The Sky card shows the moon, the seven rows and ℞ marks;
- ⓘ opens and closes, and "How Third Eye does this" lands on the right section of `http://localhost:5174/how-it-works`;
- History rows show the small moon;
- a share link shows The Sky with signs hidden.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend README.md OPERATIONS.md
git commit -m "feat(frontend): sky ritual step and How readings work links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
