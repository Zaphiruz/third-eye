# Third Eye — Today's Sky & Method Help Design

**Date:** 2026-09-30
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:** `2026-09-26-third-eye-design.md`, `2026-09-29-share-links-design.md`

## 1. Summary

Two additions requested by users:

1. **The Sky** — an eighth method: the moon phase and the zodiac sign of the Sun, Moon, Mercury, Venus, Mars, Jupiter and Saturn (with retrograde flags) for the fortune's day, computed astronomically, shown as an SVG chart, animated in the ritual, and interpreted by the oracle alongside the other methods.
2. **Method help** — an ⓘ explainer on every method card (2–3 sentences + links), and a public **How readings work** page explaining each method and how Third Eye produces a reading.

## 2. Scope

**In:** `SKY` method (calculation, storage, prompt facts, card, ritual step, history mini-glyph, share pages); `METHOD_INFO` explainer data; `<details>` explainers on cards (app + share pages); public `/how-it-works` page; links from Settings and Welcome.

**Out:** outer planets (Uranus/Neptune/Pluto), aspects between planets, personal natal charts, backfilling SKY into existing fortunes, translating help text.

## 3. The Sky Method

### 3.1 Calculation (`packages/divination`)

- Dependency: `astronomy-engine` (MIT, pure JS, no I/O). The divination package stays pure: it receives the instant to compute for.
- `castSky(at: Date): SkyData`.
- Positions: geocentric apparent ecliptic longitude (of date) for Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn. Tropical zodiac: `sign = SIGNS[floor(lon / 30)]`, `degree = floor(lon mod 30)` (0–29).
- Retrograde (Mercury…Saturn only): ecliptic longitude at `at + 1 day` is less than at `at` (unwrapped across 0°/360°). Sun and Moon: always `false`.
- Moon phase: elongation `E` = (Moon longitude − Sun longitude) mod 360. Illumination = `(1 − cos E) / 2` (fraction, 2 decimals). Waxing = `E < 180`. Names (8 buckets centred on the principal phases): new `E < 22.5 or ≥ 337.5`; waxing-crescent `< 67.5`; first-quarter `< 112.5`; waxing-gibbous `< 157.5`; full `< 202.5`; waning-gibbous `< 247.5`; last-quarter `< 292.5`; waning-crescent otherwise.

```ts
type SkyBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';
type MoonPhase = 'new' | 'waxing-crescent' | 'first-quarter' | 'waxing-gibbous'
               | 'full' | 'waning-gibbous' | 'last-quarter' | 'waning-crescent';
interface SkyData {
  moon: { phase: MoonPhase; illumination: number; waxing: boolean };
  bodies: { body: SkyBody; sign: ZodiacSignId; degree: number; retrograde: boolean }[]; // fixed order sun→saturn
}
```

- Reference data: `SKY_BODIES` (id, name, glyph ☉ ☽ ☿ ♀ ♂ ♃ ♄ with U+FE0E), `MOON_PHASE_NAMES`.

### 3.2 Integration

- `METHODS` becomes `['TAROT','RUNE','ICHING','SKY','WESTERN','CHINESE','NUMEROLOGY','BLOODTYPE']`; `MethodResult` gains `{ method: 'SKY'; data: SkyData }`; `METHOD_LABELS.SKY = 'The Sky'`.
- `castAll(profile, rng, ctx: { skyAt: Date })` — adds SKY after ICHING. (Signature change: all callers updated.)
- Backend: `skyAt` = the UTC instant of **12:00 local time** on the fortune's date in the user's time zone (helper `localNoonUtc(date, timeZone)` in `apps/backend/src/lib/dates.ts`).
- Prisma enum `Method` gains `SKY` (migration). Existing fortunes are not backfilled.
- `describeResult` for SKY facts:
  - `Moon: waxing gibbous, 78% lit, in Pisces 12°`
  - one fact per body other than the Moon: `Sun in Libra 7°`, `Mercury in Scorpio 3° (retrograde)` …
  - `Retrograde today: Mercury, Saturn` or `No planets retrograde today`
- Oracle: SKY is just another present method (schema includes it automatically); `PROMPT_VERSION` bumped; the system prompt's "never change, invent…" rule already covers it.
- Share pages: SKY is not in `BIRTH_SIGN_METHODS` → always shown.

### 3.3 Visuals (`packages/ui`)

- `SkyChart({ data })`: SVG moon disc with the lit fraction and side (waxing lit on the right, waning on the left — northern-hemisphere view), phase name and "N% lit" below; one row per non-Moon body plus the Moon: `glyph Name · 14° ♏ Scorpio`, gold `℞` when retrograde. `role="img"`/`aria-label` on the moon ("Moon: waxing gibbous, 78% lit"). Render-to-string safe.
- `MoonGlyph({ illumination, waxing, size })` reused for the moon disc and for the History mini-symbol.
- `MethodCard` renders `SkyChart` for SKY; `MiniSymbols` adds a small `MoonGlyph`.
- Ritual: new step "The heavens turn" after the I Ching (moon fades in, rows light up one by one; reduced motion → fade).

## 4. Method Help

### 4.1 Data (`packages/divination/src/data/method-info.ts`)

```ts
export interface MethodInfo { summary: string; learnMoreUrl: string; learnMoreLabel: string }
export const METHOD_INFO: Record<Method, MethodInfo>;
```
`summary`: 2–3 sentences — origin and how Third Eye casts/computes it. `learnMoreUrl`: https (Wikipedia), e.g. Tarot card reading, Runes, I Ching divination, Lunar phase, Astrological sign, Chinese zodiac, Numerology, Blood type personality theory.

### 4.2 Explainer on cards (`packages/ui` `MethodCard`)

A `<details>` element next to the card title with `<summary>` "ⓘ" (aria-label "About {Method label}"), expanding to: the summary text, a link **How Third Eye does this** → `/how-it-works#<method-lowercase>`, and **Learn more ↗** → `learnMoreUrl` with `target="_blank" rel="noopener noreferrer"`. No JavaScript required; appears in the app and on share pages.

### 4.3 `/how-it-works` page

- Public, server-rendered by the backend like share pages (same `Page` layout, inlined CSS, fonts, no JavaScript), same security headers **except** `Cache-Control: public, max-age=3600` (identical for everyone) and no `noindex` requirement (keep `noindex` anyway — it's a family app).
- Content:
  1. **How a reading is made** — draws use cryptographic randomness on the server; birth-based and sky results are calculated; the oracle (Claude) writes the interpretation from those results only and never changes them; one reading per day.
  2. **What's shared with the AI and what's stored** — only the results and your first name are sent; birth date, full name, time zone are never sent; fortunes are stored so History works; share links are opt-in and revocable.
  3. **The methods** — one `<section id="<method-lowercase>">` per method: origins, exactly how Third Eye casts it, how to read the result (reversed cards, merkstave, changing lines, retrograde, master numbers, blood-type archetypes, lunar-new-year boundary), and the learn-more link.
  4. Footer: "For reflection and entertainment."
- Long-form section text lives next to the page (`apps/backend/src/help/content.tsx`), reusing `METHOD_INFO` for the links.
- Routing: Caddy `handle /how-it-works` → backend; SW navigation denylist adds `^/how-it-works`; Vite dev proxy adds `/how-it-works`.
- Links: Settings gets "How readings work"; Welcome gets a one-line "How readings work" link. Both are plain `<a href="/how-it-works">`.

## 5. Testing

- **divination:** `castSky` against known 2026 events (instants verified with astronomy-engine while writing this spec): full moon 2026-09-26T16:49Z → at 2026-09-26T17:00Z phase `full`, illumination ≥ 0.98; new moon 2026-10-10T15:50Z → phase `new`, illumination ≤ 0.02; first quarter 2026-09-18T20:44Z → phase `first-quarter`, illumination 0.45–0.55, waxing; Mercury retrograde 2026-10-24…2026-11-14 → retrograde at 2026-11-01T12:00Z, direct at 2026-10-15T12:00Z; reference instant 2026-09-30T12:00Z → Sun Libra 7°, Moon Taurus 26°, Mercury Scorpio 0°, Venus Scorpio 8°, Mars Leo 1°, Jupiter Leo 19°, Saturn Aries 11°; Sun sign equals `sunSign()` for mid-sign dates; Sun/Moon never retrograde; `castAll` includes SKY in the right order; `describeResult(SKY)` fact strings; `METHOD_INFO` complete with https URLs.
- **backend:** `localNoonUtc` across time zones and DST; new fortunes include a SKY result computed for local noon; share page shows the SKY card even with birth signs hidden; `/how-it-works` 200 with headers, a section for every method id, no `<script>`, public (no session).
- **ui:** `SkyChart`/`MoonGlyph` render (aria labels, retrograde mark, lit side for waxing vs waning); `MethodCard` explainer renders summary + both links with the right anchor; SSR smoke still passes.
- **frontend:** ritual includes the sky step; Settings/Welcome links present.
