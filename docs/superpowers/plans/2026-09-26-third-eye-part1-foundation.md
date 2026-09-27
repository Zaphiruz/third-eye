# Third Eye — Part 1: Foundation (Tasks 1–4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Read the index first: [2026-09-26-third-eye.md](2026-09-26-third-eye.md) — its **Global Constraints** and **Cross-Task Interfaces** apply to every task here.

---

### Task 1: Monorepo scaffold, package skeletons, dev compose, CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.gitignore`, `.dockerignore`, `.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`
- Create: `packages/divination/package.json`, `packages/divination/tsconfig.json`, `packages/divination/vitest.config.ts`, `packages/divination/src/index.ts`, `packages/divination/src/types.ts`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`, `packages/shared/src/constants.ts`, `packages/shared/src/types.ts`
- Test: `packages/shared/src/constants.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every type in the index's *Cross-Task Interfaces* block for `@third-eye/divination` (`types.ts`) and `@third-eye/shared` (`constants.ts`, `types.ts`). `ERROR_CODES`, `ErrorCode`, `PERSONA_IDS`, `PersonaId`, `PERSONAS`.

The git repo already exists (`main`, one commit with the spec). Node 20+ and Docker Desktop must be available.

- [ ] **Step 1: Root workspace files**

`package.json`:
```json
{
  "name": "third-eye",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@10.33.2",
  "scripts": {
    "dev": "pnpm -r --parallel --filter=./apps/* dev",
    "build": "pnpm -r build",
    "lint": "eslint .",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "prisma:migrate": "pnpm --filter @third-eye/backend prisma migrate dev",
    "prisma:generate": "pnpm --filter @third-eye/backend prisma generate"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.5",
    "eslint": "^9.39.5",
    "eslint-plugin-react-hooks": "^5.2.0",
    "globals": "^15.15.0",
    "prettier": "^3.3.3",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.70.0"
  },
  "engines": { "node": ">=20.10.0" },
  "pnpm": {
    "onlyBuiltDependencies": ["@prisma/client", "@prisma/engines", "prisma", "esbuild"]
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022"], "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "noImplicitOverride": true, "noUncheckedIndexedAccess": true,
    "esModuleInterop": true, "forceConsistentCasingInFileNames": true, "skipLibCheck": true,
    "resolveJsonModule": true, "isolatedModules": true, "noEmit": true
  }
}
```

`eslint.config.mjs`:
```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/dev-dist/**', 'apps/backend/prisma/migrations/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker } },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  { files: ['**/*.{js,mjs,cjs}'], ...tseslint.configs.disableTypeChecked },
);
```

`.gitignore`:
```
node_modules
dist
dev-dist
.env
*.tsbuildinfo
vault-token
```

`.dockerignore`:
```
**/node_modules
**/dist
.git
.env
docs
vault-token
```

`.env.example`:
```
DATABASE_URL=postgres://third_eye:third_eye@localhost:5435/third_eye
PORT=3001
SESSION_SECRET=dev-only-secret-change-me
SESSION_COOKIE_SECURE=false
FRONTEND_ORIGIN=http://localhost:5174
AUTH_DEV_BYPASS=1
AUTHENTIK_ISSUER_URL=https://authentik.wispy-nook.casa/application/o/third-eye/
AUTHENTIK_CLIENT_ID=dev
AUTHENTIK_CLIENT_SECRET=dev
AUTHENTIK_REDIRECT_URI=http://localhost:5174/api/auth/callback
AUTHENTIK_ADMIN_GROUP=third-eye-admins
# Number of reverse-proxy hops that may set X-Forwarded-For. Production is 3 (cloudflared -> nginx -> Caddy).
TRUST_PROXY_HOPS=0
# Required. Use your own key for local dev; production reads it from Vault.
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5
```

`docker-compose.yml` (dev only; port 5435 so it can run beside Plantry's 5434):
```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: third_eye
      POSTGRES_PASSWORD: third_eye
      POSTGRES_DB: third_eye
    ports: ["5435:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

- [ ] **Step 2: Divination package skeleton with all shared types**

`packages/divination/package.json`:
```json
{
  "name": "@third-eye/divination",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run --passWithNoTests" },
  "devDependencies": { "typescript": "^5.6.3", "vitest": "^2.1.5" }
}
```

`packages/divination/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts", "vitest.config.ts"] }
```

`packages/divination/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

`packages/divination/src/types.ts`:
```ts
/** Integer in [0, maxExclusive). The ONLY source of randomness in this package. */
export type Rng = (maxExclusive: number) => number;

export type BloodType = 'A' | 'B' | 'AB' | 'O';
export const BLOOD_TYPE_IDS = ['A', 'B', 'AB', 'O'] as const satisfies readonly BloodType[];

/** Display and ritual order. castAll returns results in this order. */
export const METHODS = ['TAROT', 'RUNE', 'ICHING', 'WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE'] as const;
export type Method = (typeof METHODS)[number];

export const METHOD_LABELS: Record<Method, string> = {
  TAROT: 'Tarot', RUNE: 'Rune', ICHING: 'I Ching', WESTERN: 'Sun Sign',
  CHINESE: 'Chinese Zodiac', NUMEROLOGY: 'Numerology', BLOODTYPE: 'Blood Type',
};

/** birthDate is YYYY-MM-DD. */
export interface Profile { birthDate: string; fullName: string | null; bloodType: BloodType | null }

export type ZodiacSignId =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';
export type ChineseAnimalId =
  | 'rat' | 'ox' | 'tiger' | 'rabbit' | 'dragon' | 'snake'
  | 'horse' | 'goat' | 'monkey' | 'rooster' | 'dog' | 'pig';
export type ChineseElementId = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export type TarotPosition = 'situation' | 'challenge' | 'advice';
export interface TarotData { cards: { id: string; reversed: boolean; position: TarotPosition }[] }
export interface RuneData { id: string; reversed: boolean }
/** lines are bottom → top. 6 = old yin (changing), 7 = young yang, 8 = young yin, 9 = old yang (changing). */
export interface IChingData { lines: (6 | 7 | 8 | 9)[]; primary: number; changingLines: number[]; relating: number | null }
export interface WesternData { sign: ZodiacSignId }
export interface ChineseData { animal: ChineseAnimalId; element: ChineseElementId; polarity: 'yin' | 'yang'; lunarYear: number }
export interface NumerologyData { lifePath: number; expression: number | null }
export interface BloodTypeData { type: BloodType }

export type MethodResult =
  | { method: 'TAROT'; data: TarotData }
  | { method: 'RUNE'; data: RuneData }
  | { method: 'ICHING'; data: IChingData }
  | { method: 'WESTERN'; data: WesternData }
  | { method: 'CHINESE'; data: ChineseData }
  | { method: 'NUMEROLOGY'; data: NumerologyData }
  | { method: 'BLOODTYPE'; data: BloodTypeData };
export type MethodData = MethodResult['data'];

/** Human-readable facts about one result, used in the AI prompt and in the UI. */
export interface ResultDescription { method: Method; title: string; facts: string[] }
```

`packages/divination/src/index.ts`:
```ts
export * from './types.js';
```

- [ ] **Step 3: Shared package skeleton**

`packages/shared/package.json`:
```json
{
  "name": "@third-eye/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": { "@third-eye/divination": "workspace:*", "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.6.3", "vitest": "^2.1.5" }
}
```

`packages/shared/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts", "vitest.config.ts"] }
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
```

`packages/shared/src/constants.ts`:
```ts
export const ERROR_CODES = [
  'validation_error', 'unauthorized', 'forbidden', 'not_found', 'needs_onboarding', 'rate_limited', 'internal',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const PERSONA_IDS = ['MYSTIC', 'CONFIDANT', 'TRICKSTER'] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];
export const DEFAULT_PERSONA: PersonaId = 'CONFIDANT';

/** Display metadata only. The system prompts live in apps/backend/src/oracle/personas.ts. */
export const PERSONAS: Record<PersonaId, { name: string; tagline: string; sampleLine: string }> = {
  MYSTIC: {
    name: 'The Mystic',
    tagline: 'Candlelit, theatrical, steeped in omen.',
    sampleLine: 'The veil parts, seeker… the Tower rises in your path, and the old walls tremble.',
  },
  CONFIDANT: {
    name: 'The Confidant',
    tagline: 'Warm, grounded, a friend who knows the symbols.',
    sampleLine: 'The Tower suggests something you have been holding together may need to shift — give yourself room.',
  },
  TRICKSTER: {
    name: 'The Trickster',
    tagline: 'Playful, cheeky, lovingly unimpressed.',
    sampleLine: 'The Tower, reversed. Something is about to go sideways and you are pretending it is not. Very on-brand.',
  },
};

export const HISTORY_PAGE_SIZE = 20;
```

`packages/shared/src/types.ts`:
```ts
import type { BloodType, Method, MethodData } from '@third-eye/divination';
import type { PersonaId } from './constants.js';

export interface ProfileDto {
  birthDate: string | null;       // YYYY-MM-DD
  fullName: string | null;
  bloodType: BloodType | null;
  timeZone: string;               // IANA
  persona: PersonaId;
}

export interface MeDto {
  user: { sub: string; name: string; email: string; isAdmin: boolean };
  profile: ProfileDto;
  onboarded: boolean;             // birthDate !== null
}

export type FortuneStatus = 'PENDING' | 'READY' | 'FAILED';

export interface FortuneResultDto { method: Method; data: MethodData; reading: string | null }

export interface FortuneDto {
  id: string;
  date: string;                   // YYYY-MM-DD, the user's local date
  status: FortuneStatus;
  persona: PersonaId;
  summary: string | null;
  results: FortuneResultDto[];    // METHODS order
}

export interface TodayDto { fortune: FortuneDto; fresh: boolean }

export interface FortuneSummaryDto {
  id: string;
  date: string;
  status: FortuneStatus;
  persona: PersonaId;
  excerpt: string | null;         // first sentence of summary, max 160 chars
  results: FortuneResultDto[];    // readings omitted (null) to keep the page small
}

export interface FortunePageDto { items: FortuneSummaryDto[]; nextCursor: string | null }

export interface ApiErrorBody { error: { code: string; message: string; details?: unknown } }
```

`packages/shared/src/index.ts`:
```ts
export * from './constants.js';
export * from './types.js';
```

- [ ] **Step 4: Write the failing test**

`packages/shared/src/constants.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, PERSONA_IDS, PERSONAS, DEFAULT_PERSONA } from './index.js';

describe('constants', () => {
  it('has every error code the API uses', () => {
    expect([...ERROR_CODES].sort()).toEqual(
      ['forbidden', 'internal', 'needs_onboarding', 'not_found', 'rate_limited', 'unauthorized', 'validation_error'],
    );
  });
  it('has display metadata for every persona and a valid default', () => {
    for (const id of PERSONA_IDS) {
      expect(PERSONAS[id].name.length).toBeGreaterThan(0);
      expect(PERSONAS[id].sampleLine.length).toBeGreaterThan(20);
    }
    expect(PERSONA_IDS).toContain(DEFAULT_PERSONA);
  });
});
```

- [ ] **Step 5: Install and run the tests**

Run: `corepack enable; pnpm install; pnpm --filter @third-eye/shared test`
Expected: PASS (2 tests). If you run the test before creating `constants.ts` it fails with "Failed to resolve import"; the scaffold is written in one go here because the test only checks static data.

Run: `pnpm typecheck; pnpm lint`
Expected: both exit 0.

- [ ] **Step 6: CI workflow**

`.github/workflows/ci.yml` — runs on **GitHub-hosted** runners only. The repo is public; nothing here may use the self-hosted runner.
```yaml
name: CI
on:
  push:
    paths-ignore: ["**.md", "docs/**", ".env.example"]
  pull_request:
    paths-ignore: ["**.md", "docs/**", ".env.example"]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_USER: third_eye, POSTGRES_PASSWORD: third_eye, POSTGRES_DB: third_eye_test }
        ports: ["5435:5432"]
        options: >-
          --health-cmd "pg_isready -U third_eye" --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      TEST_DATABASE_URL: postgres://third_eye:third_eye@localhost:5435/third_eye_test
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```
(Task 2 inserts the Prisma generate/migrate steps before `pnpm lint`.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with shared and divination packages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Prisma schema, backend skeleton, test harness

**Files:**
- Create: `apps/backend/package.json`, `apps/backend/tsconfig.json`, `apps/backend/tsup.config.ts`, `apps/backend/vitest.config.ts`, `apps/backend/scripts/test-db-setup.mjs`
- Create: `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/migrations/<timestamp>_init/migration.sql` (generated)
- Create: `apps/backend/src/config.ts`, `errors.ts`, `logging.ts`, `app.ts`, `server.ts`, `lib/ids.ts`, `lib/dates.ts`
- Create: `apps/backend/src/test/helpers/setup.ts`, `db.ts`, `fakes.ts`, `test-app.ts`
- Modify: `.github/workflows/ci.yml` (add Prisma steps)
- Test: `apps/backend/src/lib/dates.test.ts`, `apps/backend/src/config.test.ts`, `apps/backend/src/app.test.ts`

**Interfaces:**
- Consumes: `ErrorCode` from `@third-eye/shared`.
- Produces:
  - `loadConfig(env?): AppConfig` with `anthropic: { apiKey: string; model: string }`.
  - `AppError(status, code, message, details?)`, `notFound()`, `forbidden()`, `parse(schema, data)`.
  - `localDate(now: Date, timeZone: string): string`, `toDbDate(d: string): Date`, `fromDbDate(d: Date): string`.
  - `uuidParam(v: unknown): string` (throws 404 on non-UUID).
  - `buildApp(options: BuildAppOptions): Promise<FastifyInstance>` — this task's options: `logger?, prisma, frontendOrigin, sessionSecret, cookieSecure, disableRateLimit?, rateLimitMax?, trustProxyHops?`. Tasks 3 and 16 add more.
  - Test helpers: `getTestPrisma()`, `resetDatabase()`, `createTestApp(): Promise<TestCtx>` with `ctx.call(user, method, url, body?, headers?)`.

- [ ] **Step 1: Backend package files**

`apps/backend/package.json`:
```json
{
  "name": "@third-eye/backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "dotenv -e ../../.env -- tsx watch src/server.ts",
    "build": "tsup",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:db:setup": "node scripts/test-db-setup.mjs",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "prisma": "dotenv -e ../../.env -- prisma"
  },
  "prisma": { "schema": "prisma/schema.prisma" },
  "dependencies": {
    "@fastify/cookie": "^11.0.1",
    "@fastify/rate-limit": "^10.2.1",
    "@prisma/client": "^5.22.0",
    "@third-eye/divination": "workspace:*",
    "@third-eye/shared": "workspace:*",
    "fastify": "^5.1.0",
    "openid-client": "^5.7.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "dotenv-cli": "^7.4.2",
    "prisma": "^5.22.0",
    "tsup": "^8.3.5",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

`apps/backend/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["node"] }, "include": ["src/**/*.ts", "tsup.config.ts", "vitest.config.ts"] }
```

`apps/backend/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  noExternal: ['@third-eye/shared', '@third-eye/divination'],
  sourcemap: true,
  clean: true,
});
```

`apps/backend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/helpers/setup.ts'],
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
});
```

`apps/backend/scripts/test-db-setup.mjs`:
```js
import { execSync } from 'node:child_process';
const URL_ = process.env.TEST_DATABASE_URL ?? 'postgres://third_eye:third_eye@localhost:5435/third_eye_test';
try {
  execSync('docker compose exec -T postgres psql -U third_eye -d third_eye -c "CREATE DATABASE third_eye_test"', {
    stdio: 'inherit', cwd: new URL('../../..', import.meta.url),
  });
} catch { /* already exists */ }
execSync('corepack pnpm exec prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: URL_ } });
```

- [ ] **Step 2: Prisma schema**

`apps/backend/prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Persona {
  MYSTIC
  CONFIDANT
  TRICKSTER
}

enum BloodType {
  A
  B
  AB
  O
}

enum FortuneStatus {
  PENDING
  READY
  FAILED
}

enum Method {
  TAROT
  RUNE
  ICHING
  WESTERN
  CHINESE
  NUMEROLOGY
  BLOODTYPE
}

model User {
  sub         String     @id
  name        String
  email       String
  birthDate   DateTime?  @map("birth_date") @db.Date
  fullName    String?    @map("full_name")
  bloodType   BloodType? @map("blood_type")
  timeZone    String     @default("UTC") @map("time_zone")
  persona     Persona    @default(CONFIDANT)
  lastLoginAt DateTime   @map("last_login_at") @db.Timestamptz(6)
  createdAt   DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)

  sessions Session[]
  fortunes Fortune[]

  @@map("users")
}

model Session {
  idHash    String   @id @map("id_hash")
  userSub   String   @map("user_sub")
  data      Json
  expiresAt DateTime @map("expires_at") @db.Timestamptz(6)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  user      User     @relation(fields: [userSub], references: [sub], onDelete: Cascade)

  @@index([expiresAt])
  @@map("sessions")
}

model Fortune {
  id              String        @id @default(uuid()) @db.Uuid
  userSub         String        @map("user_sub")
  date            DateTime      @db.Date
  status          FortuneStatus @default(PENDING)
  persona         Persona
  profileSnapshot Json          @map("profile_snapshot")
  summary         String?
  model           String?
  promptVersion   String?       @map("prompt_version")
  attempts        Int           @default(0)
  lastError       String?       @map("last_error")
  startedAt       DateTime      @default(now()) @map("started_at") @db.Timestamptz(6)
  completedAt     DateTime?     @map("completed_at") @db.Timestamptz(6)
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)

  user    User            @relation(fields: [userSub], references: [sub], onDelete: Cascade)
  results FortuneResult[]

  // Also serves history (userSub = ? ORDER BY date DESC) via a backward index scan.
  @@unique([userSub, date])
  @@map("fortunes")
}

model FortuneResult {
  id        String  @id @default(uuid()) @db.Uuid
  fortuneId String  @map("fortune_id") @db.Uuid
  method    Method
  data      Json
  reading   String?
  fortune   Fortune @relation(fields: [fortuneId], references: [id], onDelete: Cascade)

  @@unique([fortuneId, method])
  @@map("fortune_results")
}
```

- [ ] **Step 3: Generate the initial migration**

Run:
```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm --filter @third-eye/backend prisma migrate dev --name init
pnpm --filter @third-eye/backend test:db:setup
```
Expected: `apps/backend/prisma/migrations/<timestamp>_init/migration.sql` is created and applied; the test DB `third_eye_test` is created and migrated.

- [ ] **Step 4: Write the failing tests for dates and config**

`apps/backend/src/lib/dates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fromDbDate, localDate, toDbDate } from './dates.js';

describe('localDate', () => {
  const instant = new Date('2026-09-27T03:30:00Z');
  it('gives different calendar dates for the same instant in different zones', () => {
    expect(localDate(instant, 'UTC')).toBe('2026-09-27');
    expect(localDate(instant, 'America/Chicago')).toBe('2026-09-26');
    expect(localDate(instant, 'Asia/Tokyo')).toBe('2026-09-27');
  });
  it('zero-pads month and day', () => {
    expect(localDate(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
  });
});

describe('db date conversion', () => {
  it('round-trips a calendar date without drifting a day', () => {
    expect(fromDbDate(toDbDate('1990-02-28'))).toBe('1990-02-28');
    expect(toDbDate('1990-02-28').toISOString()).toBe('1990-02-28T00:00:00.000Z');
  });
});
```

`apps/backend/src/config.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  DATABASE_URL: 'postgres://x', FRONTEND_ORIGIN: 'http://localhost:5174', SESSION_SECRET: 's',
  AUTHENTIK_ISSUER_URL: 'https://a/', AUTHENTIK_CLIENT_ID: 'id', AUTHENTIK_CLIENT_SECRET: 'sec',
  AUTHENTIK_REDIRECT_URI: 'http://localhost:5174/api/auth/callback', ANTHROPIC_API_KEY: 'sk-test',
};

describe('loadConfig', () => {
  it('loads defaults', () => {
    const c = loadConfig(base);
    expect(c.port).toBe(3000);
    expect(c.adminGroup).toBe('third-eye-admins');
    expect(c.anthropic).toEqual({ apiKey: 'sk-test', model: 'claude-sonnet-5' });
    expect(c.trustProxyHops).toBe(0);
  });
  it('refuses to start without an Anthropic key', () => {
    const { ANTHROPIC_API_KEY: _omit, ...rest } = base;
    expect(() => loadConfig(rest)).toThrow('ANTHROPIC_API_KEY');
  });
  it('refuses AUTH_DEV_BYPASS in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', AUTH_DEV_BYPASS: '1' })).toThrow('AUTH_DEV_BYPASS');
  });
  it('honours ANTHROPIC_MODEL', () => {
    expect(loadConfig({ ...base, ANTHROPIC_MODEL: 'claude-opus-5' }).anthropic.model).toBe('claude-opus-5');
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/lib src/config.test.ts`
Expected: FAIL — cannot resolve `./dates.js` / `./config.js`.

- [ ] **Step 5: Implement dates, config, errors, logging, ids**

`apps/backend/src/lib/dates.ts`:
```ts
/** The calendar date (YYYY-MM-DD) that `now` falls on in `timeZone`. */
export function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** YYYY-MM-DD → the Date Prisma needs for a @db.Date column. */
export const toDbDate = (d: string): Date => new Date(`${d}T00:00:00.000Z`);

/** @db.Date value → YYYY-MM-DD. */
export const fromDbDate = (d: Date): string => d.toISOString().slice(0, 10);
```

`apps/backend/src/config.ts`:
```ts
export interface AppConfig {
  port: number; nodeEnv: string; databaseUrl: string; frontendOrigin: string;
  sessionSecret: string; cookieSecure: boolean; adminGroup: string; devBypass: boolean;
  trustProxyHops: number;
  oidc: { issuer: string; clientId: string; clientSecret: string; redirectUri: string };
  anthropic: { apiKey: string; model: string };
}
type Env = Record<string, string | undefined>;

/** Proxy hops that may set X-Forwarded-For. Defaults to 0 (trust nothing) so misconfiguration fails closed. */
function trustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  return n;
}

export function loadConfig(env: Env = process.env): AppConfig {
  const required = (name: string): string => {
    const v = env[name];
    if (!v) throw new Error(`Missing required environment variable: ${name}`);
    return v;
  };
  const nodeEnv = env['NODE_ENV'] ?? 'development';
  const devBypass = env['AUTH_DEV_BYPASS'] === '1';
  if (devBypass && nodeEnv === 'production') throw new Error('AUTH_DEV_BYPASS must not be set in production');

  return {
    port: Number(env['PORT'] ?? '3000'), nodeEnv,
    databaseUrl: required('DATABASE_URL'),
    frontendOrigin: required('FRONTEND_ORIGIN'),
    sessionSecret: required('SESSION_SECRET'),
    cookieSecure: (env['SESSION_COOKIE_SECURE'] ?? (nodeEnv === 'production' ? 'true' : 'false')) === 'true',
    adminGroup: env['AUTHENTIK_ADMIN_GROUP'] ?? 'third-eye-admins',
    devBypass,
    trustProxyHops: trustProxyHops(env['TRUST_PROXY_HOPS']),
    oidc: {
      issuer: required('AUTHENTIK_ISSUER_URL'), clientId: required('AUTHENTIK_CLIENT_ID'),
      clientSecret: required('AUTHENTIK_CLIENT_SECRET'), redirectUri: required('AUTHENTIK_REDIRECT_URI'),
    },
    // The oracle is the product: no key, no start.
    anthropic: { apiKey: required('ANTHROPIC_API_KEY'), model: env['ANTHROPIC_MODEL'] || 'claude-sonnet-5' },
  };
}
```

`apps/backend/src/errors.ts`:
```ts
import type { z } from 'zod';
import type { ErrorCode } from '@third-eye/shared';

export class AppError extends Error {
  constructor(public status: number, public code: ErrorCode, message: string, public details?: unknown) {
    super(message);
  }
}
export const notFound = (message = 'Not found') => new AppError(404, 'not_found', message);
export const forbidden = (message = 'Forbidden') => new AppError(403, 'forbidden', message);

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(400, 'validation_error', 'Invalid request', r.error.flatten());
  return r.data;
}
```

`apps/backend/src/logging.ts`:
```ts
import type { FastifyServerOptions } from 'fastify';

export interface SerializableRequest { method: string; url: string; ip?: string }

/** Logs the request PATH only — query strings can carry OIDC codes and state. */
export function serializeRequest(req: SerializableRequest) {
  const url = req.url ?? '';
  const cut = url.search(/[?#]/);
  return { method: req.method, url: cut === -1 ? url : url.slice(0, cut), remoteAddress: req.ip };
}

export const loggerOptions = {
  redact: { paths: ['req.headers.cookie', 'req.headers.authorization'], remove: true },
  serializers: { req: serializeRequest },
} satisfies FastifyServerOptions['logger'];
```

`apps/backend/src/lib/ids.ts`:
```ts
import { notFound } from '../errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);

/** A malformed id is indistinguishable from one that doesn't exist. */
export function uuidParam(v: unknown): string {
  if (!isUuid(v)) throw notFound();
  return v.toLowerCase();
}
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/lib src/config.test.ts`
Expected: PASS (7 tests). (These don't touch the DB, but the setup file still requires the `_test` URL — it's the default.)

- [ ] **Step 6: Write the failing app test**

`apps/backend/src/app.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from './test/helpers/test-app.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });

describe('app skeleton', () => {
  it('serves liveness and readiness', async () => {
    expect((await ctx.call(null, 'GET', '/health')).body).toEqual({ status: 'ok' });
    expect((await ctx.call(null, 'GET', '/api/ready')).body).toEqual({ status: 'ok' });
  });
  it('returns the error envelope for unknown routes', async () => {
    const r = await ctx.call(null, 'GET', '/api/nope');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: { code: 'not_found', message: 'Not found' } });
  });
  it('rejects mutating requests from a foreign origin', async () => {
    const r = await ctx.call(null, 'POST', '/api/nope', {}, { origin: 'https://evil.example' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('forbidden');
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/app.test.ts`
Expected: FAIL — cannot resolve `./test/helpers/test-app.js`.

- [ ] **Step 7: Implement app skeleton, server and test helpers**

`apps/backend/src/app.ts`:
```ts
import Fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@prisma/client';
import { AppError } from './errors.js';

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger'];
  prisma: PrismaClient;
  frontendOrigin: string;
  sessionSecret: string;
  cookieSecure: boolean;
  disableRateLimit?: boolean;
  rateLimitMax?: number;
  /** Proxy hops to trust for req.ip / X-Forwarded-For. 0 (default) trusts none. */
  trustProxyHops?: number;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  // Fastify's numeric trustProxy is a no-op; the hop-count predicate is what proxy-addr honours.
  const trustProxyHops = options.trustProxyHops ?? 0;
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: (_addr: string, hop: number) => hop < trustProxyHops,
  });

  await app.register(cookie, { secret: options.sessionSecret });

  if (!options.disableRateLimit) {
    await app.register(rateLimit, {
      global: true,
      max: options.rateLimitMax ?? 600,
      timeWindow: '1 minute',
      allowList: (req) => req.url === '/health',
      keyGenerator: (req) => `ip:${req.ip}`,
    });
  }

  app.addHook('onRequest', async (req) => {
    if (SAFE_METHODS.has(req.method)) return;
    if (req.headers.origin !== options.frontendOrigin) throw new AppError(403, 'forbidden', 'Bad origin');
  });

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({
        error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
      });
    }
    const status = (err as FastifyError).statusCode;
    if (status === 429) return reply.code(429).send({ error: { code: 'rate_limited', message: 'Too many requests' } });
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: { code: 'validation_error', message: err.message } });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'internal', message: 'Internal error' } });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } }),
  );

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/api/ready', async (req, reply) => {
    try {
      await options.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (err) {
      req.log.error({ err }, 'readiness probe failed');
      return reply.code(503).send({ status: 'degraded' });
    }
  });

  return app;
}
```

`apps/backend/src/server.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { loggerOptions } from './logging.js';

const config = loadConfig();
const prisma = new PrismaClient();

const app = await buildApp({
  logger: loggerOptions,
  trustProxyHops: config.trustProxyHops,
  prisma,
  frontendOrigin: config.frontendOrigin,
  sessionSecret: config.sessionSecret,
  cookieSecure: config.cookieSecure,
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void app.close().then(() => prisma.$disconnect()).then(() => process.exit(0));
  });
}

await app.listen({ host: '0.0.0.0', port: config.port });
app.log.info({ model: config.anthropic.model, devBypass: config.devBypass }, 'third-eye backend ready');
```

`apps/backend/src/test/helpers/setup.ts`:
```ts
const TEST_URL = 'postgres://third_eye:third_eye@localhost:5435/third_eye_test';
process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? TEST_URL;
if (!process.env['DATABASE_URL'].endsWith('_test')) {
  throw new Error('Refusing to run tests: DATABASE_URL must end with _test');
}
```

`apps/backend/src/test/helpers/db.ts`:
```ts
import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;
export function getTestPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}

export async function resetDatabase(): Promise<void> {
  const p = getTestPrisma();
  await p.fortuneResult.deleteMany();
  await p.fortune.deleteMany();
  await p.session.deleteMany();
  await p.user.deleteMany();
}
```

`apps/backend/src/test/helpers/fakes.ts`:
```ts
// Fakes are added here as later tasks introduce the interfaces they stand in for.
export {};
```

`apps/backend/src/test/helpers/test-app.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import { getTestPrisma } from './db.js';

export const TEST_ORIGIN = 'http://localhost:5174';
export interface TestUser { sub: string; name: string; cookie: string }
export interface CallResult { status: number; body: any; headers: Record<string, unknown> }

export interface TestCtx {
  app: FastifyInstance;
  prisma: PrismaClient;
  call(user: TestUser | null, method: string, url: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<CallResult>;
  close(): Promise<void>;
}

export async function createTestApp(): Promise<TestCtx> {
  const prisma = getTestPrisma();
  const app = await buildApp({
    prisma, frontendOrigin: TEST_ORIGIN, sessionSecret: 'test-secret', cookieSecure: false, disableRateLimit: true,
  });
  await app.ready();
  return {
    app,
    prisma,
    async call(user, method, url, body, extraHeaders = {}) {
      const res = await app.inject({
        method: method as 'GET',
        url,
        headers: {
          origin: TEST_ORIGIN,
          ...(user ? { cookie: user.cookie } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...extraHeaders,
        },
        ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
      });
      let parsed: unknown = null;
      try { parsed = res.body ? JSON.parse(res.body) : null; } catch { parsed = res.body; }
      return { status: res.statusCode, body: parsed, headers: res.headers };
    },
    async close() { await app.close(); },
  };
}
```

- [ ] **Step 8: Run the backend tests**

Run: `pnpm --filter @third-eye/backend test`
Expected: PASS (10 tests).

Run: `pnpm typecheck; pnpm lint`
Expected: exit 0.

- [ ] **Step 9: Add Prisma steps to CI**

In `.github/workflows/ci.yml`, insert these two steps immediately after `- run: pnpm install --frozen-lockfile`:
```yaml
      - run: pnpm --filter @third-eye/backend exec prisma generate
      - run: pnpm --filter @third-eye/backend exec prisma migrate deploy
        env: { DATABASE_URL: "postgres://third_eye:third_eye@localhost:5435/third_eye_test" }
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(backend): prisma schema, app skeleton and test harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Auth — sessions, OIDC, middleware, dev bypass, `GET /api/me`

**Files:**
- Create: `apps/backend/src/auth/session.ts`, `oidc.ts`, `middleware.ts`, `routes.ts`, `dev-bypass.ts`
- Create: `apps/backend/src/profile/routes.ts` (GET only in this task)
- Modify: `apps/backend/src/app.ts`, `apps/backend/src/server.ts`, `apps/backend/src/test/helpers/fakes.ts`, `apps/backend/src/test/helpers/test-app.ts`
- Test: `apps/backend/src/auth/session.test.ts`, `apps/backend/src/auth/routes.test.ts`

**Interfaces:**
- Consumes: `buildApp`, `AppError`, `fromDbDate`, `MeDto` / `ProfileDto` from shared.
- Produces:
  - `app.requireAuth` preHandler; `req.user: RequestUser = { sub, name, email, isAdmin }`.
  - `createSessionStore(prisma, ttlSeconds): SessionStore`, `hashSid(sid)`.
  - `OidcClient` interface + `createOidcClient(config)`.
  - `serializeProfile(user: User): ProfileDto` and `GET /api/me → { data: MeDto }` in `src/profile/routes.ts`.
  - `BuildAppOptions` gains `oidcClient: OidcClient; adminGroup?: string; sessionTtlSeconds?: number; devBypass?: boolean`.
  - Test ctx gains `fakeOidc: FakeOidcClient` and `user(opts?: { name?; admin?; birthDate?: string | null; bloodType?; fullName?; timeZone?; persona? }): Promise<TestUser>` — by default the user is **onboarded** with `birthDate: '1990-06-15'`, `timeZone: 'UTC'`.

- [ ] **Step 1: Write the failing session store test**

`apps/backend/src/auth/session.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { getTestPrisma, resetDatabase } from '../test/helpers/db.js';
import { createSessionStore, hashSid } from './session.js';

const prisma = getTestPrisma();
beforeEach(async () => {
  await resetDatabase();
  await prisma.user.create({ data: { sub: 'u1', name: 'U', email: 'u@x', lastLoginAt: new Date() } });
});

describe('session store', () => {
  it('creates, reads and destroys; stores only the hash', async () => {
    const store = createSessionStore(prisma, 3600);
    const sid = await store.create('u1', { groups: ['third-eye-admins'] });
    expect(sid.length).toBeGreaterThanOrEqual(43);
    expect(await prisma.session.findUnique({ where: { idHash: sid } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { idHash: hashSid(sid) } })).not.toBeNull();
    expect((await store.get(sid))?.data.groups).toEqual(['third-eye-admins']);
    await store.destroy(sid);
    expect(await store.get(sid)).toBeNull();
  });

  it('treats expired sessions as missing and deletes them', async () => {
    const store = createSessionStore(prisma, -1);
    const sid = await store.create('u1', { groups: [] });
    expect(await store.get(sid)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it('touch slides the expiry forward', async () => {
    const store = createSessionStore(prisma, 3600);
    const sid = await store.create('u1', { groups: [] });
    await prisma.session.update({ where: { idHash: hashSid(sid) }, data: { expiresAt: new Date(Date.now() + 1000) } });
    await store.touch(sid);
    expect((await store.get(sid))!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 3000_000);
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/auth/session.test.ts`
Expected: FAIL — cannot resolve `./session.js`.

- [ ] **Step 2: Implement the session store**

`apps/backend/src/auth/session.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

export interface SessionData { groups: string[]; idToken?: string }
export interface SessionRecord { userSub: string; data: SessionData; expiresAt: Date }
export interface SessionStore {
  create(userSub: string, data: SessionData): Promise<string>;
  get(sid: string): Promise<SessionRecord | null>;
  touch(sid: string): Promise<void>;
  destroy(sid: string): Promise<void>;
}

export const hashSid = (sid: string): string => createHash('sha256').update(sid).digest('hex');

export function createSessionStore(prisma: PrismaClient, ttlSeconds: number): SessionStore {
  const expiry = () => new Date(Date.now() + ttlSeconds * 1000);
  return {
    async create(userSub, data) {
      const sid = randomBytes(32).toString('base64url');
      await prisma.session.create({
        data: { idHash: hashSid(sid), userSub, data: data as unknown as Prisma.InputJsonValue, expiresAt: expiry() },
      });
      return sid;
    },
    async get(sid) {
      const row = await prisma.session.findUnique({ where: { idHash: hashSid(sid) } });
      if (!row) return null;
      if (row.expiresAt.getTime() <= Date.now()) {
        await prisma.session.deleteMany({ where: { idHash: row.idHash } });
        return null;
      }
      return { userSub: row.userSub, data: row.data as unknown as SessionData, expiresAt: row.expiresAt };
    },
    async touch(sid) {
      await prisma.session.updateMany({ where: { idHash: hashSid(sid) }, data: { expiresAt: expiry() } });
    },
    async destroy(sid) {
      await prisma.session.deleteMany({ where: { idHash: hashSid(sid) } });
    },
  };
}
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/auth/session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: OIDC client (copied from Plantry, unchanged in behaviour)**

`apps/backend/src/auth/oidc.ts`:
```ts
/**
 * Minimal abstraction over the OIDC provider so routes can be tested without a real Authentik.
 * Discovery is deferred (and retried after failure) so the backend boots even if Authentik is down.
 */
export interface OidcAuthorizationArtifacts { url: string; state: string; nonce: string; codeVerifier: string }
export interface OidcUserinfo {
  sub: string; email: string; name?: string; preferred_username?: string; groups: string[]; idToken?: string;
}
export interface OidcClient {
  authorizationUrl(): OidcAuthorizationArtifacts | Promise<OidcAuthorizationArtifacts>;
  exchange(input: { code: string; state: string; nonce: string; codeVerifier: string }): Promise<OidcUserinfo>;
  endSessionUrl?(opts?: { idTokenHint?: string; postLogoutRedirectUri?: string }): string | null | Promise<string | null>;
}
export interface OidcConfig { issuer: string; clientId: string; clientSecret: string; redirectUri: string; scopesExtra?: string[] }

type InnerClient = {
  authorizationUrl(): OidcAuthorizationArtifacts;
  exchange(input: { code: string; state: string; nonce: string; codeVerifier: string }): Promise<OidcUserinfo>;
  endSessionUrl(opts?: { idTokenHint?: string; postLogoutRedirectUri?: string }): string | null;
};

export function createOidcClient(config: OidcConfig): OidcClient {
  let clientPromise: Promise<InnerClient> | undefined;
  function getClient(): Promise<InnerClient> {
    if (!clientPromise) {
      clientPromise = buildClient(config);
      // A single Authentik blip during boot must not poison the client until restart.
      clientPromise.catch(() => { clientPromise = undefined; });
    }
    return clientPromise;
  }
  return {
    async authorizationUrl() { return (await getClient()).authorizationUrl(); },
    async exchange(input) { return (await getClient()).exchange(input); },
    async endSessionUrl(opts) {
      try { return (await getClient()).endSessionUrl(opts); } catch { return null; }
    },
  };
}

async function buildClient(config: OidcConfig): Promise<InnerClient> {
  const { Issuer, generators, custom } = await import('openid-client');
  // Authentik behind Cloudflare can take several seconds on token POSTs; the 3500ms default is too tight.
  custom.setHttpOptionsDefaults({ timeout: 10000 });
  const issuer = await Issuer.discover(config.issuer);
  const client = new issuer.Client({
    client_id: config.clientId, client_secret: config.clientSecret,
    redirect_uris: [config.redirectUri], response_types: ['code'],
  });
  const scope = ['openid', 'profile', 'email', ...(config.scopesExtra ?? ['goauthentik.io/providers/oauth2/scope-groups'])].join(' ');

  return {
    authorizationUrl() {
      const state = generators.state();
      const nonce = generators.nonce();
      const codeVerifier = generators.codeVerifier();
      const url = client.authorizationUrl({
        scope, state, nonce, code_challenge: generators.codeChallenge(codeVerifier), code_challenge_method: 'S256',
      });
      return { url, state, nonce, codeVerifier };
    },
    async exchange({ code, state, nonce, codeVerifier }) {
      const tokenSet = await client.callback(config.redirectUri, { code, state }, { state, nonce, code_verifier: codeVerifier });
      const userinfo = await client.userinfo(tokenSet.access_token ?? '');
      const groupsRaw = (userinfo as unknown as { groups?: unknown }).groups;
      const groups = Array.isArray(groupsRaw) ? groupsRaw.filter((g): g is string => typeof g === 'string') : [];
      return {
        sub: userinfo.sub,
        email: (userinfo.email ?? '') as string,
        name: userinfo.name as string | undefined,
        preferred_username: userinfo.preferred_username as string | undefined,
        groups,
        idToken: tokenSet.id_token,
      };
    },
    endSessionUrl(opts) {
      try {
        const params: Record<string, string> = {};
        if (opts?.idTokenHint) params.id_token_hint = opts.idTokenHint;
        if (opts?.postLogoutRedirectUri) params.post_logout_redirect_uri = opts.postLogoutRedirectUri;
        return client.endSessionUrl(Object.keys(params).length > 0 ? params : undefined);
      } catch { return null; }
    },
  };
}
```

- [ ] **Step 4: Middleware**

`apps/backend/src/auth/middleware.ts`:
```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../errors.js';
import type { SessionStore } from './session.js';

export interface RequestUser { sub: string; name: string; email: string; isAdmin: boolean }

declare module 'fastify' {
  interface FastifyRequest { user?: RequestUser }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthMiddlewareDeps {
  prisma: PrismaClient; sessionStore: SessionStore; cookieName: string;
  cookieSecure: boolean; ttlSeconds: number; adminGroup: string;
}

const unauthorized = (m: string) => new AppError(401, 'unauthorized', m);

export function makeRequireAuth(deps: AuthMiddlewareDeps) {
  return async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const sid = req.cookies[deps.cookieName];
    if (!sid) throw unauthorized('No session');
    const session = await deps.sessionStore.get(sid);
    if (!session) throw unauthorized('Invalid session');
    const user = await deps.prisma.user.findUnique({ where: { sub: session.userSub } });
    if (!user) throw unauthorized('User not found');

    // Sliding expiry: once less than 6/7 of the TTL remains, extend DB row and cookie.
    if (session.expiresAt.getTime() - Date.now() < deps.ttlSeconds * 1000 * (6 / 7)) {
      await deps.sessionStore.touch(sid);
      reply.setCookie(deps.cookieName, sid, {
        path: '/', httpOnly: true, sameSite: 'lax', secure: deps.cookieSecure, maxAge: deps.ttlSeconds,
      });
    }
    req.user = { sub: user.sub, name: user.name, email: user.email, isAdmin: session.data.groups.includes(deps.adminGroup) };
  };
}
```

- [ ] **Step 5: Auth routes, dev bypass, `GET /api/me`**

`apps/backend/src/auth/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../errors.js';
import type { OidcClient } from './oidc.js';
import type { SessionStore } from './session.js';

export interface AuthRouteDeps {
  prisma: PrismaClient; sessionStore: SessionStore; oidcClient: OidcClient; cookieName: string;
  cookieSecure: boolean; ttlSeconds: number; frontendOrigin: string;
}

interface PkcePayload { state: string; nonce: string; codeVerifier: string }
const PKCE_COOKIE = 'third_eye_oidc';
const bad = (m: string) => new AppError(400, 'validation_error', m);

const encode = (p: PkcePayload) => Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
function decode(v: string): PkcePayload | null {
  try {
    const p = JSON.parse(Buffer.from(v, 'base64url').toString('utf8')) as PkcePayload;
    return typeof p.state === 'string' && typeof p.nonce === 'string' && typeof p.codeVerifier === 'string' ? p : null;
  } catch { return null; }
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const limit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.get('/api/auth/login', limit, async (_req, reply) => {
    const a = await deps.oidcClient.authorizationUrl();
    reply.setCookie(PKCE_COOKIE, encode({ state: a.state, nonce: a.nonce, codeVerifier: a.codeVerifier }), {
      path: '/api/auth', httpOnly: true, sameSite: 'lax', secure: deps.cookieSecure, signed: true, maxAge: 600,
    });
    return reply.redirect(a.url);
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/api/auth/callback', limit, async (req, reply) => {
    const { code, state, error } = req.query;
    if (error) throw bad(`Provider returned: ${error}`);
    if (!code || !state) throw bad('Missing code or state');
    const raw = req.cookies[PKCE_COOKIE];
    const unsigned = raw ? req.unsignCookie(raw) : null;
    const payload = unsigned?.valid && unsigned.value ? decode(unsigned.value) : null;
    if (!payload || payload.state !== state) throw bad('State mismatch');

    let info;
    try {
      info = await deps.oidcClient.exchange({ code, state, nonce: payload.nonce, codeVerifier: payload.codeVerifier });
    } catch (err) {
      req.log.error({ err }, 'oidc exchange failed');
      throw bad('Token exchange failed');
    }
    const name = info.name?.trim() || info.preferred_username?.trim() || info.email || info.sub;
    await deps.prisma.user.upsert({
      where: { sub: info.sub },
      create: { sub: info.sub, name, email: info.email, lastLoginAt: new Date() },
      update: { name, email: info.email, lastLoginAt: new Date() },
    });
    reply.clearCookie(PKCE_COOKIE, { path: '/api/auth' });
    const sid = await deps.sessionStore.create(info.sub, { groups: info.groups, ...(info.idToken ? { idToken: info.idToken } : {}) });
    reply.setCookie(deps.cookieName, sid, { path: '/', httpOnly: true, sameSite: 'lax', secure: deps.cookieSecure, maxAge: deps.ttlSeconds });
    return reply.redirect(`${deps.frontendOrigin}/`);
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const sid = req.cookies[deps.cookieName];
    let idTokenHint: string | undefined;
    if (sid) {
      idTokenHint = (await deps.sessionStore.get(sid))?.data.idToken;
      await deps.sessionStore.destroy(sid);
    }
    reply.clearCookie(deps.cookieName, { path: '/' });
    const endSessionUrl = deps.oidcClient.endSessionUrl
      ? await deps.oidcClient.endSessionUrl({ postLogoutRedirectUri: deps.frontendOrigin, ...(idTokenHint ? { idTokenHint } : {}) })
      : null;
    return { data: { ok: true, endSessionUrl } };
  });
}
```

`apps/backend/src/auth/dev-bypass.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { AuthRouteDeps } from './routes.js';

/** Local dev only. loadConfig refuses AUTH_DEV_BYPASS when NODE_ENV=production. */
export function registerDevBypass(app: FastifyInstance, deps: AuthRouteDeps, adminGroup: string): void {
  app.get<{ Querystring: { sub?: string; name?: string; admin?: string } }>('/api/auth/dev-login', async (req, reply) => {
    const sub = req.query.sub ?? 'dev-user';
    const name = req.query.name ?? 'Dev User';
    await deps.prisma.user.upsert({
      where: { sub },
      create: { sub, name, email: `${sub}@dev.local`, lastLoginAt: new Date() },
      update: { name, lastLoginAt: new Date() },
    });
    const sid = await deps.sessionStore.create(sub, { groups: req.query.admin === '1' ? [adminGroup] : [] });
    reply.setCookie(deps.cookieName, sid, { path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: deps.ttlSeconds });
    return reply.redirect(`${deps.frontendOrigin}/`);
  });
}
```

`apps/backend/src/profile/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { PrismaClient, User } from '@prisma/client';
import type { MeDto, ProfileDto } from '@third-eye/shared';
import { fromDbDate } from '../lib/dates.js';

export function serializeProfile(u: User): ProfileDto {
  return {
    birthDate: u.birthDate ? fromDbDate(u.birthDate) : null,
    fullName: u.fullName,
    bloodType: u.bloodType,
    timeZone: u.timeZone,
    persona: u.persona,
  };
}

export function registerProfileRoutes(app: FastifyInstance, deps: { prisma: PrismaClient }): void {
  app.get('/api/me', { preHandler: app.requireAuth }, async (req) => {
    const u = await deps.prisma.user.findUniqueOrThrow({ where: { sub: req.user!.sub } });
    const profile = serializeProfile(u);
    const data: MeDto = { user: req.user!, profile, onboarded: profile.birthDate !== null };
    return { data };
  });
}
```

- [ ] **Step 6: Wire auth into `buildApp` and `server.ts`**

In `apps/backend/src/app.ts`:

Add imports:
```ts
import { makeRequireAuth } from './auth/middleware.js';
import { registerAuthRoutes, type AuthRouteDeps } from './auth/routes.js';
import { registerDevBypass } from './auth/dev-bypass.js';
import { createSessionStore } from './auth/session.js';
import type { OidcClient } from './auth/oidc.js';
import { registerProfileRoutes } from './profile/routes.js';
```

Add to `BuildAppOptions`:
```ts
  oidcClient: OidcClient;
  adminGroup?: string;
  sessionTtlSeconds?: number;
  devBypass?: boolean;
```

After the rate-limit registration block, add:
```ts
  const cookieName = 'third_eye_sid';
  const ttlSeconds = options.sessionTtlSeconds ?? 7 * 24 * 60 * 60;
  const adminGroup = options.adminGroup ?? 'third-eye-admins';
  const sessionStore = createSessionStore(options.prisma, ttlSeconds);
  app.decorate('requireAuth', makeRequireAuth({
    prisma: options.prisma, sessionStore, cookieName, cookieSecure: options.cookieSecure, ttlSeconds, adminGroup,
  }));
```

Immediately before `return app;`, add:
```ts
  const authDeps: AuthRouteDeps = {
    prisma: options.prisma, sessionStore, oidcClient: options.oidcClient, cookieName,
    cookieSecure: options.cookieSecure, ttlSeconds, frontendOrigin: options.frontendOrigin,
  };
  registerAuthRoutes(app, authDeps);
  if (options.devBypass) registerDevBypass(app, authDeps, adminGroup);
  registerProfileRoutes(app, { prisma: options.prisma });
```

In `apps/backend/src/server.ts`, add `import { createOidcClient } from './auth/oidc.js';` and extend the `buildApp({...})` call with:
```ts
  adminGroup: config.adminGroup,
  devBypass: config.devBypass,
  oidcClient: createOidcClient(config.oidc),
```

- [ ] **Step 7: Test helpers — fake OIDC and user factory**

Replace `apps/backend/src/test/helpers/fakes.ts`:
```ts
import type { OidcClient, OidcUserinfo } from '../../auth/oidc.js';

export class FakeOidcClient implements OidcClient {
  userinfo: OidcUserinfo = { sub: 'sub-0', email: 'fake@example.com', name: 'Fake', groups: [], idToken: 'idt' };
  authorizationUrl() {
    return { url: 'https://auth.example/authorize', state: 'state-0', nonce: 'nonce-0', codeVerifier: 'cv-0' };
  }
  async exchange() { return this.userinfo; }
  endSessionUrl() { return 'https://auth.example/logout'; }
}
```

Replace `apps/backend/src/test/helpers/test-app.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import type { BloodType, Persona, PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import { createSessionStore } from '../../auth/session.js';
import { toDbDate } from '../../lib/dates.js';
import { getTestPrisma } from './db.js';
import { FakeOidcClient } from './fakes.js';

export const TEST_ORIGIN = 'http://localhost:5174';
export const TEST_COOKIE = 'third_eye_sid';
export interface TestUser { sub: string; name: string; cookie: string }
export interface CallResult { status: number; body: any; headers: Record<string, unknown> }
export interface UserOpts {
  name?: string; admin?: boolean; birthDate?: string | null; fullName?: string | null;
  bloodType?: BloodType | null; timeZone?: string; persona?: Persona;
}

export interface TestCtx {
  app: FastifyInstance;
  prisma: PrismaClient;
  fakeOidc: FakeOidcClient;
  call(user: TestUser | null, method: string, url: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<CallResult>;
  /** Onboarded by default (birthDate 1990-06-15, UTC). Pass birthDate: null for a fresh user. */
  user(opts?: UserOpts): Promise<TestUser>;
  close(): Promise<void>;
}

export async function createTestApp(): Promise<TestCtx> {
  const prisma = getTestPrisma();
  const fakeOidc = new FakeOidcClient();
  const sessions = createSessionStore(prisma, 3600);
  const app = await buildApp({
    prisma, frontendOrigin: TEST_ORIGIN, sessionSecret: 'test-secret', cookieSecure: false,
    oidcClient: fakeOidc, adminGroup: 'third-eye-admins', devBypass: false, disableRateLimit: true,
  });
  await app.ready();
  let n = 0;
  return {
    app,
    prisma,
    fakeOidc,
    async call(user, method, url, body, extraHeaders = {}) {
      const res = await app.inject({
        method: method as 'GET',
        url,
        headers: {
          origin: TEST_ORIGIN,
          ...(user ? { cookie: user.cookie } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...extraHeaders,
        },
        ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
      });
      let parsed: unknown = null;
      try { parsed = res.body ? JSON.parse(res.body) : null; } catch { parsed = res.body; }
      return { status: res.statusCode, body: parsed, headers: res.headers };
    },
    async user(opts = {}) {
      n++;
      const sub = `sub-${Date.now()}-${n}`;
      const name = opts.name ?? `User ${n}`;
      const birthDate = opts.birthDate === undefined ? '1990-06-15' : opts.birthDate;
      await prisma.user.create({
        data: {
          sub, name, email: `u${n}@example.com`, lastLoginAt: new Date(),
          birthDate: birthDate ? toDbDate(birthDate) : null,
          fullName: opts.fullName ?? null,
          bloodType: opts.bloodType ?? null,
          timeZone: opts.timeZone ?? 'UTC',
          ...(opts.persona ? { persona: opts.persona } : {}),
        },
      });
      const sid = await sessions.create(sub, { groups: opts.admin ? ['third-eye-admins'] : [] });
      return { sub, name, cookie: `${TEST_COOKIE}=${sid}` };
    },
    async close() { await app.close(); },
  };
}
```

- [ ] **Step 8: Write the auth route tests**

`apps/backend/src/auth/routes.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(resetDatabase);

function cookieFrom(headers: Record<string, unknown>, name: string): string | undefined {
  const raw = headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  return list.find((c) => c.startsWith(`${name}=`))?.split(';')[0];
}

describe('auth', () => {
  it('login sets the signed state cookie and redirects to the provider', async () => {
    const r = await ctx.call(null, 'GET', '/api/auth/login');
    expect(r.status).toBe(302);
    expect(r.headers['location']).toBe('https://auth.example/authorize');
    expect(cookieFrom(r.headers, 'third_eye_oidc')).toBeDefined();
  });

  it('callback upserts the user, creates a session, and /me reports a not-yet-onboarded profile', async () => {
    ctx.fakeOidc.userinfo = { sub: 'abc', email: 'a@b.c', name: 'Ada', groups: ['third-eye-admins'], idToken: 't' };
    const login = await ctx.call(null, 'GET', '/api/auth/login');
    const state = cookieFrom(login.headers, 'third_eye_oidc')!;
    const cb = await ctx.call(null, 'GET', '/api/auth/callback?code=c&state=state-0', undefined, { cookie: state });
    expect(cb.status).toBe(302);
    expect(cb.headers['location']).toBe('http://localhost:5174/');
    const sid = cookieFrom(cb.headers, 'third_eye_sid')!;
    const me = await ctx.call(null, 'GET', '/api/me', undefined, { cookie: sid });
    expect(me.status).toBe(200);
    expect(me.body.data).toEqual({
      user: { sub: 'abc', name: 'Ada', email: 'a@b.c', isAdmin: true },
      profile: { birthDate: null, fullName: null, bloodType: null, timeZone: 'UTC', persona: 'CONFIDANT' },
      onboarded: false,
    });
  });

  it('callback rejects a state mismatch', async () => {
    const login = await ctx.call(null, 'GET', '/api/auth/login');
    const state = cookieFrom(login.headers, 'third_eye_oidc')!;
    const cb = await ctx.call(null, 'GET', '/api/auth/callback?code=c&state=WRONG', undefined, { cookie: state });
    expect(cb.status).toBe(400);
  });

  it('/me is 401 without a session; onboarded users are reported as such', async () => {
    expect((await ctx.call(null, 'GET', '/api/me')).status).toBe(401);
    const u = await ctx.user();
    const me = await ctx.call(u, 'GET', '/api/me');
    expect(me.body.data.user.isAdmin).toBe(false);
    expect(me.body.data.onboarded).toBe(true);
    expect(me.body.data.profile.birthDate).toBe('1990-06-15');
  });

  it('logout destroys the session', async () => {
    const u = await ctx.user();
    const out = await ctx.call(u, 'POST', '/api/auth/logout');
    expect(out.status).toBe(200);
    expect(out.body.data.endSessionUrl).toBe('https://auth.example/logout');
    expect((await ctx.call(u, 'GET', '/api/me')).status).toBe(401);
  });

  it('dev-login does not exist unless devBypass is on', async () => {
    expect((await ctx.call(null, 'GET', '/api/auth/dev-login?sub=x')).status).toBe(404);
  });
});
```

- [ ] **Step 9: Run all backend tests**

Run: `pnpm --filter @third-eye/backend test`
Expected: PASS (all tests from Tasks 2–3, 19 total).

Run: `pnpm typecheck; pnpm lint`
Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(backend): authentik oidc login, postgres sessions, GET /api/me

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Profile — `PATCH /api/me` and the shared profile schema

**Files:**
- Create: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/index.ts`, `apps/backend/src/profile/routes.ts`
- Test: `packages/shared/src/schemas.test.ts`, `apps/backend/src/profile/routes.test.ts`

**Interfaces:**
- Consumes: `BLOOD_TYPE_IDS` (divination), `PERSONA_IDS` (shared), `serializeProfile`, `parse`, `toDbDate`.
- Produces: `isValidTimeZone(tz: string): boolean`, `isoDateSchema`, `profileUpdateSchema`, `ProfileUpdateInput` (all exported from `@third-eye/shared`); `PATCH /api/me → { data: MeDto }`.

- [ ] **Step 1: Write the failing schema test**

`packages/shared/src/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isValidTimeZone, profileUpdateSchema } from './schemas.js';

const ok = (v: unknown) => profileUpdateSchema.safeParse(v).success;

describe('profileUpdateSchema', () => {
  it('accepts a full onboarding payload', () => {
    expect(profileUpdateSchema.parse({
      birthDate: '1990-06-15', fullName: '  Ada Lovelace ', bloodType: 'AB', timeZone: 'America/Chicago', persona: 'MYSTIC',
    })).toEqual({ birthDate: '1990-06-15', fullName: 'Ada Lovelace', bloodType: 'AB', timeZone: 'America/Chicago', persona: 'MYSTIC' });
  });
  it('turns a blank name into null and allows clearing blood type', () => {
    expect(profileUpdateSchema.parse({ fullName: '   ', bloodType: null })).toEqual({ fullName: null, bloodType: null });
  });
  it('rejects impossible, future and pre-1900 birth dates', () => {
    expect(ok({ birthDate: '1990-02-30' })).toBe(false);
    expect(ok({ birthDate: '2999-01-01' })).toBe(false);
    expect(ok({ birthDate: '1899-12-31' })).toBe(false);
    expect(ok({ birthDate: '15/06/1990' })).toBe(false);
  });
  it('rejects null birth dates (it is required once set), unknown keys, and empty bodies', () => {
    expect(ok({ birthDate: null })).toBe(false);
    expect(ok({ favouriteColour: 'blue' })).toBe(false);
    expect(ok({})).toBe(false);
  });
  it('rejects bad enums and time zones', () => {
    expect(ok({ bloodType: 'C' })).toBe(false);
    expect(ok({ persona: 'WIZARD' })).toBe(false);
    expect(ok({ timeZone: 'Mars/Olympus_Mons' })).toBe(false);
  });
});

describe('isValidTimeZone', () => {
  it('knows real IANA zones', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });
});
```

Run: `pnpm --filter @third-eye/shared test`
Expected: FAIL — cannot resolve `./schemas.js`.

- [ ] **Step 2: Implement the schema**

`packages/shared/src/schemas.ts`:
```ts
import { z } from 'zod';
import { BLOOD_TYPE_IDS } from '@third-eye/divination';
import { PERSONA_IDS } from './constants.js';

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** A real calendar date in YYYY-MM-DD form. */
export const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Not a real date');

const birthDateSchema = isoDateSchema
  .refine((s) => s >= '1900-01-01', 'Birth date must be in 1900 or later')
  .refine((s) => s < new Date().toISOString().slice(0, 10), 'Birth date must be in the past');

export const profileUpdateSchema = z.object({
  birthDate: birthDateSchema,
  fullName: z.string().trim().max(120).nullable().transform((s) => (s ? s : null)),
  bloodType: z.enum(BLOOD_TYPE_IDS).nullable(),
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone'),
  persona: z.enum(PERSONA_IDS),
}).partial().strict().refine((o) => Object.keys(o).length > 0, 'Nothing to update');

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
```

Update `packages/shared/src/index.ts`:
```ts
export * from './constants.js';
export * from './schemas.js';
export * from './types.js';
```

Run: `pnpm --filter @third-eye/shared test`
Expected: PASS (8 tests).

- [ ] **Step 3: Write the failing route test**

`apps/backend/src/profile/routes.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(resetDatabase);

describe('PATCH /api/me', () => {
  it('onboards a fresh user', async () => {
    const u = await ctx.user({ birthDate: null });
    const r = await ctx.call(u, 'PATCH', '/api/me', {
      birthDate: '1988-02-10', fullName: 'Ada Lovelace', bloodType: 'O', timeZone: 'America/Chicago', persona: 'TRICKSTER',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.onboarded).toBe(true);
    expect(r.body.data.profile).toEqual({
      birthDate: '1988-02-10', fullName: 'Ada Lovelace', bloodType: 'O', timeZone: 'America/Chicago', persona: 'TRICKSTER',
    });
  });

  it('updates a single field and leaves the rest alone', async () => {
    const u = await ctx.user({ bloodType: 'A' });
    const r = await ctx.call(u, 'PATCH', '/api/me', { persona: 'MYSTIC' });
    expect(r.body.data.profile).toMatchObject({ birthDate: '1990-06-15', bloodType: 'A', persona: 'MYSTIC' });
  });

  it('returns field errors for invalid input', async () => {
    const u = await ctx.user();
    const r = await ctx.call(u, 'PATCH', '/api/me', { birthDate: '2999-01-01', timeZone: 'Nope/Nope' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation_error');
    expect(Object.keys(r.body.error.details.fieldErrors).sort()).toEqual(['birthDate', 'timeZone']);
  });

  it('requires a session and a same-origin request', async () => {
    expect((await ctx.call(null, 'PATCH', '/api/me', { persona: 'MYSTIC' })).status).toBe(401);
    const u = await ctx.user();
    expect((await ctx.call(u, 'PATCH', '/api/me', { persona: 'MYSTIC' }, { origin: 'https://evil.example' })).status).toBe(403);
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/profile`
Expected: FAIL — `PATCH /api/me` returns 404.

- [ ] **Step 4: Implement `PATCH /api/me`**

In `apps/backend/src/profile/routes.ts`, add imports:
```ts
import { profileUpdateSchema } from '@third-eye/shared';
import { parse } from '../errors.js';
import { toDbDate } from '../lib/dates.js';
```
(merge `toDbDate` into the existing `../lib/dates.js` import), and add inside `registerProfileRoutes`, after the GET route:
```ts
  app.patch('/api/me', { preHandler: app.requireAuth }, async (req) => {
    const input = parse(profileUpdateSchema, req.body);
    const u = await deps.prisma.user.update({
      where: { sub: req.user!.sub },
      data: {
        ...(input.birthDate !== undefined ? { birthDate: toDbDate(input.birthDate) } : {}),
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.bloodType !== undefined ? { bloodType: input.bloodType } : {}),
        ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
        ...(input.persona !== undefined ? { persona: input.persona } : {}),
      },
    });
    const profile = serializeProfile(u);
    const data: MeDto = { user: req.user!, profile, onboarded: profile.birthDate !== null };
    return { data };
  });
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: PASS across shared and backend.

Run: `pnpm typecheck; pnpm lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: profile update endpoint with shared validation schema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
