# Third Eye — Design Spec

**Date:** 2026-09-26
**Status:** Approved in brainstorming, pending written-spec review

## 1. Summary

Third Eye is a self-hosted web app that gives each signed-in user **one daily fortune**. Each fortune combines seven divination methods from several cultures, computed/drawn by deterministic code, and is then interpreted by Claude into an overall summary plus a short reading per method, in the voice of the user's chosen oracle persona. Users can browse their past fortunes.

Users: family and friends, gated by Authentik. Hosted on S2 alongside the other homelab apps, following the Plantry template.

## 2. Scope

### In scope (v1)

- Authentik OIDC login.
- Onboarding/profile: birth date (**required**), full birth name (optional), blood type (optional), time zone (auto-detected), persona.
- Seven methods, **all applicable methods used every day**:

| Method | Input | Output |
|---|---|---|
| Tarot | — | 3-card spread: Situation / Challenge / Advice, each may be reversed (78-card deck) |
| Runes | — | 1 Elder Futhark rune (24), may be reversed (merkstave) if the rune is not symmetric |
| I Ching | — | Primary hexagram via 3-coin method (6 lines), changing lines, relating hexagram |
| Western zodiac | birth date | Sun sign |
| Chinese zodiac | birth date | Animal + element + yin/yang, using Lunar New Year boundaries |
| Numerology | birth date (+ name) | Life Path number; Expression number if name present. Master numbers 11/22/33 preserved |
| Blood type | blood type | Japanese *ketsueki-gata* trait profile |

- Methods whose inputs are missing are skipped silently (only blood type and name-based numerology can be missing).
- One fortune per user per local calendar day, generated lazily on first open that day.
- Animated "ritual" reveal of the real draws while the AI interpretation is generated.
- Three personas: **Mystic** (theatrical), **Confidant** (warm, grounded — default), **Trickster** (playful, cheeky).
- History of past fortunes, each viewable in full.

### Out of scope (v1)

Question-driven readings, full natal charts (moon/rising), palmistry, Vedic/Mayan systems, per-user method toggles, account deletion, sharing fortunes, push notifications, admin UI (the `third-eye-admins` group is captured but unused in v1).

## 3. Architecture

Stack matches Plantry: TypeScript pnpm monorepo, Fastify 5 + Prisma backend, React + Vite + Tailwind + RTK Query frontend served by Caddy 2, PWA via vite-plugin-pwa. No Redis, no worker process.

```
third-eye/
├── apps/
│   ├── backend/
│   │   ├── src/auth/        OIDC login/callback/logout, third_eye_sid session (Postgres-backed)
│   │   ├── src/profile/     GET/PATCH /me
│   │   ├── src/fortunes/    today (get-or-create), get by id, history
│   │   ├── src/oracle/      Anthropic client, persona prompts, tool schema, zod validation
│   │   └── entrypoint.mjs   Vault secret loading (Plantry pattern)
│   └── frontend/            React app, Caddyfile
├── packages/
│   ├── divination/          pure TS, no I/O
│   │   ├── tarot.ts runes.ts iching.ts                         random draws, injectable RNG
│   │   ├── western.ts chinese.ts numerology.ts bloodtype.ts    computations/lookups
│   │   ├── index.ts         castAll(profile, rng): MethodResult[]
│   │   └── data/            tarot (78), runes (24), hexagrams (64), lunar-new-year dates, blood-type traits
│   └── shared/              API types (request/response DTOs, enums)
├── docker-compose.prod.yml
├── .github/workflows/ci.yml, deploy.yml
├── OPERATIONS.md
└── docs/superpowers/
```

### Unit boundaries

- **`divination`** — knows nothing about users, DB, or AI. `castAll(profile, rng)` returns a list of discriminated-union `MethodResult` objects. Each method module exports `cast(profile, rng): Result | null`; `null` means "inputs missing, skip". Reference data provides names, keywords, and short canonical meanings used to enrich prompts and render UI.
- **`oracle`** — `interpret(fortune): Promise<void>`. Builds the prompt, calls Claude, validates, persists. The only module that talks to Anthropic.
- **`fortunes`** — orchestrates: date resolution, get-or-create, persisting draws, kicking off `oracle.interpret`, staleness/retry rules.
- **`shared`** — types only.

RNG: production uses `crypto.randomInt`; tests inject a seeded RNG.

## 4. Data Model (Prisma, database `third_eye`)

```prisma
enum Persona      { MYSTIC CONFIDANT TRICKSTER }
enum BloodType    { A B AB O }
enum FortuneStatus { PENDING READY FAILED }
enum Method       { TAROT RUNE ICHING WESTERN CHINESE NUMEROLOGY BLOODTYPE }

model User {
  id            String    @id @default(cuid())
  authentikSub  String    @unique
  email         String
  displayName   String
  isAdmin       Boolean   @default(false)   // from `groups` claim at each login
  birthDate     DateTime? @db.Date          // required before fortunes; null until onboarded
  fullName      String?
  bloodType     BloodType?
  timeZone      String    @default("UTC")   // IANA
  persona       Persona   @default(CONFIDANT)
  createdAt     DateTime  @default(now())
  sessions      Session[]
  fortunes      Fortune[]
}

model Session {
  id        String   @id                 // random 32-byte token, cookie value
  userId    String
  expiresAt DateTime                     // 7 days
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Fortune {
  id              String        @id @default(cuid())
  userId          String
  date            DateTime      @db.Date   // user's local date
  status          FortuneStatus @default(PENDING)
  persona         Persona
  profileSnapshot Json                     // {birthDate, fullName, bloodType, timeZone}
  summary         String?
  model           String?
  promptVersion   String?
  attempts        Int           @default(0)
  lastError       String?
  startedAt       DateTime      @default(now())   // reset on each interpretation attempt
  completedAt     DateTime?
  results         FortuneResult[]
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, date])
  @@index([userId, date(sort: Desc)])
}

model FortuneResult {
  id        String  @id @default(cuid())
  fortuneId String
  method    Method
  data      Json      // raw draw/computation, e.g. {cards:[{id:"major-16",reversed:true,position:"challenge"}]}
  reading   String?   // AI interpretation, null until READY
  fortune   Fortune @relation(fields: [fortuneId], references: [id], onDelete: Cascade)
  @@unique([fortuneId, method])
}
```

`profileSnapshot` and `persona` are frozen per fortune so history stays accurate if the profile changes later.

## 5. API

All under `/api`; all require a session unless marked *public*.

| Route | Purpose |
|---|---|
| `GET /auth/login` *(public)* | Start OIDC (state in `third_eye_oidc` cookie) |
| `GET /auth/callback` *(public)* | Exchange code, upsert user by `sub`, set `isAdmin` from groups, create session, set `third_eye_sid` |
| `POST /auth/logout` | Delete session, clear cookie |
| `GET /ready` *(public)* | `SELECT 1` health check |
| `GET /me` | User + profile + `onboarded` (= `birthDate != null`) |
| `PATCH /me` | Update `birthDate`, `fullName`, `bloodType`, `timeZone`, `persona` (zod-validated; birth date must be in the past and after 1900-01-01; `timeZone` must be a valid IANA zone) |
| `POST /fortunes/today` | Get or create today's fortune (see §6) |
| `GET /fortunes/:id` | Fortune with results; used for polling; 404 if not the caller's |
| `GET /fortunes?cursor=` | History, newest first, page size 20, cursor = last `date` |

Fortune response shape (in `packages/shared`):

```ts
type FortuneDTO = {
  id: string; date: string; status: 'PENDING'|'READY'|'FAILED';
  persona: Persona; summary: string | null; fresh?: boolean;
  results: { method: Method; data: MethodResultData; reading: string | null }[];
};
```

The frontend renders result `data` using reference data it imports from `divination/data` (card names, rune glyphs, hexagram names), so the API carries only IDs.

## 6. Fortune Flow

### `POST /fortunes/today`

1. If `birthDate` is null → `409 { error: "needs_onboarding" }`.
2. `today` = current date in the user's `timeZone`.
3. Look up `Fortune(userId, today)`:
   - **READY** → return it, `fresh: false`.
   - **PENDING, `startedAt` < 2 min ago** → return it (client keeps polling).
   - **FAILED, or PENDING ≥ 2 min** → reset `startedAt`, keep existing draws, fire `oracle.interpret(id)` (not awaited), return it.
4. Not found → `divination.castAll(profile, cryptoRng)`; in one transaction insert `Fortune` (PENDING, persona, snapshot) + `FortuneResult` rows (reading null); fire `oracle.interpret(id)` (not awaited); return `201` with `fresh: true`.
5. Race: if the insert violates `@@unique([userId, date])`, re-read and continue at step 3.

**Draws are never re-rolled** for a given day — retries only redo the interpretation.

### `oracle.interpret(fortuneId)`

1. Load fortune + results. Build the prompt:
   - System prompt: persona voice + rules (stay in character, second person, no medical/financial/legal directives, entertainment framing, length targets: summary 120–200 words, each reading 1–3 sentences).
   - User content: profile snapshot (first name only, never full birth name beyond what numerology needs), today's date, and each result enriched with reference meanings (card upright/reversed keywords, rune meaning, hexagram name + judgment gist + changing-line note, sign/animal/number/blood-type traits).
2. Call Claude via the Anthropic SDK with a **forced tool call** whose input schema is `{ summary: string, readings: { [method]: string } }`, restricted to the methods present.
3. Validate with zod: every present method has a non-empty reading; no extra methods.
4. Success → one transaction: set `summary`, each `reading`, `status=READY`, `model`, `promptVersion`, `completedAt`.
5. Failure (timeout 45s, API error, invalid output) → retry once. Second failure → `status=FAILED`, `lastError`, `attempts++`.
6. Model from `ANTHROPIC_MODEL` (default `claude-sonnet-5`). `PROMPT_VERSION` constant in code, bumped on prompt changes.

Personas live in `oracle/personas.ts` as `{ id, name, tagline, sampleLine, systemPrompt }`; `name`, `tagline`, and `sampleLine` are also exported to the frontend via `shared` for onboarding.

## 7. Frontend

Mobile-first PWA, dark celestial theme (deep indigo / near-black, gold accents, display serif for headings). Framer Motion + CSS for animation; `prefers-reduced-motion` reduces the ritual to simple fades.

### Screens

1. **Login** — single "Enter" button → `/api/auth/login`.
2. **Onboarding** (when `onboarded=false`) — birth date (required), full birth name (optional, "used for numerology"), blood type (optional, includes "I don't know"), persona picker with each persona's sample line. Time zone auto-filled from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
3. **Today** (home):
   - `fresh: true` → play the **ritual**, then show the fortune.
   - `fresh: false` and READY → show fortune directly, with a "Replay the ritual" button.
   - FAILED → "The spirits are quiet… try again" button (re-calls `POST /fortunes/today`).
4. **History** — infinite list: date, first line of summary, mini icons (cards, rune glyph, hexagram). Tap → fortune detail (same layout as Today, no ritual).
5. **Settings** — edit profile + persona, logout. Time zone editable (auto-detected default).

### Ritual sequence (each step ~2–3s, tap to skip ahead)

1. **Tarot** — deck shuffles; three cards deal and flip into Situation / Challenge / Advice (reversed cards land inverted).
2. **Rune** — rune drawn from a pouch, lands upright or merkstave.
3. **I Ching** — six coin tosses build the hexagram bottom-up; changing lines glow; relating hexagram appears alongside.
4. **Birth signs** — sun sign, Chinese animal/element, life-path number, blood type illuminate around a ring (skipped entries simply absent).
5. **"The oracle speaks…"** — holds until status READY (RTK Query polls `GET /fortunes/:id` every 2s while PENDING), then summary writes in and per-method cards expand below.

Only draws are animated before READY; if READY arrives early, the ritual still completes. Tarot faces are rendered in SVG (numeral, name, symbol) — no licensed art.

## 8. Error Handling

| Situation | Behaviour |
|---|---|
| Anthropic timeout/error/invalid output | One automatic retry, then FAILED; user can retry (draws kept) |
| Backend restart mid-interpretation | PENDING ≥ 2 min treated as stale and re-kicked on next request |
| `ANTHROPIC_API_KEY` missing | Backend refuses to start with a clear log message (oracle is core) |
| Invalid profile input | 400 with zod field errors; shown inline |
| Fortune id not owned by caller | 404 |
| Session expired | 401 → frontend redirects to login |

Logging: Fastify's pino logger; log user IDs and fortune IDs only — never birth date, name, blood type, or prompt contents.

## 9. Testing

- **`divination`** (Vitest, seeded RNG): sun-sign cusp dates; Chinese zodiac for Jan/Feb births on both sides of Lunar New Year; numerology reduction incl. master numbers 11/22/33 and name letter mapping; I Ching coin-toss → line values → correct primary/relating hexagram lookup; merkstave only for asymmetric runes; data completeness (78 cards, 24 runes, 64 hexagrams, lunar-new-year table covers 1900–2100).
- **`oracle`**: fake Anthropic client — valid output persists; missing/extra methods rejected; retry path; FAILED after second failure; prompt excludes skipped methods.
- **`fortunes`** (integration, real Postgres): get-or-create; concurrent-request race yields one fortune; stale PENDING re-kick; FAILED retry keeps draws; time zone date boundary (same instant = different dates for different zones); history pagination; ownership 404.
- **Frontend**: component tests for onboarding validation and fortune rendering; manual smoke test of the ritual before first deploy.

## 10. Deployment & Operations

Matches Plantry conventions (see `D:\docs\Mikrotik\CLAUDE.md` new-app checklist).

- **Repo:** `Zaphiruz/third-eye`, **public**.
- **CI/CD safety for a public repo with a self-hosted runner:**
  - `ci.yml` runs on `pull_request` and `push` using **GitHub-hosted** `ubuntu-latest` (Postgres service container for integration tests).
  - `deploy.yml` runs on the **self-hosted** runner **only** via `workflow_run` after CI succeeds on a `push` to `main`; never on `pull_request` / `pull_request_target`.
  - Repo setting: require approval for workflow runs from all outside contributors / forks.
  - Runner scoped to this repo only, runs as unprivileged `runner` user.
  - No secrets in repo; `.env` on S2 contains only `VAULT_ADDR` + `VAULT_TOKEN`.
- **Deploy pipeline** (as Plantry): checkout the CI-passed SHA → build (3 retries) → `prisma migrate deploy` with `DATABASE_URL` from Vault → `docker compose up -d` → poll `/api/ready` → prune images.
- **S2:** `/opt/third-eye/docker-compose.prod.yml`; frontend (Caddy) bound to `192.168.40.20:3009` (verify free with `ss -ltn`); backend internal only; joins external `shared-db` network; Caddy `trusted_proxies 192.168.40.11/32`, `TRUST_PROXY_HOPS=3`; Node containers mount Origin CA and set `NODE_EXTRA_CA_CERTS`; Prisma `binaryTargets = ["native","linux-musl-openssl-3.0.x"]`.
- **Postgres:** role + DB `third_eye` on shared PG 17, `CREATE DATABASE … TEMPLATE template0`. Covered by existing nightly `pg_dumpall`.
- **Vault** `secret/third-eye`: `DATABASE_URL`, `AUTHENTIK_ISSUER_URL`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, `AUTHENTIK_REDIRECT_URI`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. App token via `/opt/vault/add-app-token.sh`, stored at `/opt/third-eye/vault-token` (400, `runner`).
- **Authentik:** OIDC provider + application slug `third-eye`, confidential, RS256, redirect `https://third-eye.wispy-nook.casa/api/auth/callback`, scopes `openid profile email` + groups mapping; groups `third-eye-users` (bound as access policy) and `third-eye-admins`.
- **Ingress:** `third-eye.wispy-nook.casa` → Cloudflare Tunnel → nginx on LC2 → `192.168.40.20:3009`.
- **Docs:** `OPERATIONS.md` in repo; add an entry to `D:\docs\Mikrotik\CLAUDE.md`.
- Manual infra steps (Authentik, Vault, PG role, nginx, tunnel hostname, runner registration) are delivered as a checklist for the user to perform; they touch shared systems.

## 11. Cost Estimate

One Sonnet call per user per day, roughly 3–4k input tokens (reference meanings) and ~800 output tokens — on the order of a cent per fortune. No cost for users who don't open the app.
