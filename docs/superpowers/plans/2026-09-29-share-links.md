# Share Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user share a READY fortune with people who have no account, via revocable read-only links rendered as static server-side HTML.

**Architecture:** The fortune view and symbol components move into a new `packages/ui` used by both the React app and the backend. A `shares` table stores per-link settings (`sharedByName`, `includeBirthSigns`, `revokedAt`). Signed-in API routes create/list/revoke links; a public `GET /s/:token` renders the shared fortune with `react-dom/server` into a JavaScript-free page with Open Graph tags and an inlined Tailwind stylesheet generated at build time. Caddy routes `/s/*` to the backend.

**Tech Stack:** existing stack (Fastify 5, Prisma 5, React 18, Tailwind 3, Vitest 2) + `react-dom/server` in the backend.

**Spec:** `docs/superpowers/specs/2026-09-29-share-links-design.md` — read it first. Base design: `docs/superpowers/specs/2026-09-26-third-eye-design.md`.

## Global Constraints

- Branch `share-links` (already checked out). Repo `D:\code\third-eye`, Windows + Git Bash, pnpm 10.33.2, Node ≥ 20. Dev Postgres in Docker on `localhost:5435` (`docker compose up -d postgres`); backend tests use `third_eye_test`.
- Commit trailer exactly: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Relative imports in `packages/*` and `apps/backend` use `.js` extensions (NodeNext). `packages/ui` follows the same rule (the backend type-checks it under NodeNext).
- Birth-based methods, hidden unless `includeBirthSigns`: `WESTERN`, `CHINESE`, `NUMEROLOGY`, `BLOODTYPE`. Always shown: `TAROT`, `RUNE`, `ICHING`, persona, summary.
- Tokens: `crypto.randomBytes(16).toString('base64url')` (22 chars). Valid token regex: `^[A-Za-z0-9_-]{22}$`.
- `sharedByName`: trimmed, 1–60 chars. `includeBirthSigns` default in the UI: **off**.
- New error code `not_ready` (409).
- Share URL: `${FRONTEND_ORIGIN}/s/${token}`.
- Public page headers: `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
- Rate limits: create share 20/min; public page 60/min.
- The public page contains **no `<script>`**. All user text is rendered through React (escaped); the only `dangerouslySetInnerHTML` is the build-time CSS.
- Never change the look of the components while moving them.

## File Structure

```
packages/ui/                         NEW @third-eye/ui
  package.json  tsconfig.json  vitest.config.ts  tailwind-preset.ts
  src/index.ts  src/theme.css  src/test-setup.ts
  src/FortuneView.tsx  src/MethodCard.tsx  src/FortuneView.test.tsx  src/ssr.test.tsx
  src/symbols/TarotCard.tsx  RuneStone.tsx  Hexagram.tsx  SignRing.tsx  symbols.test.tsx
apps/frontend/                       imports from @third-eye/ui; tailwind uses the preset; new ShareDialog
  src/components/ShareDialog.tsx  ShareDialog.test.tsx
apps/backend/
  prisma/schema.prisma (+ Share)  prisma/migrations/<ts>_shares/
  scripts/build-share-css.mjs  tailwind.share.config.ts
  src/shares/service.ts  routes.ts  public-routes.ts  page.tsx  share.css  fonts.ts
  src/shares/generated/share-css.ts  (generated, gitignored)
  src/shares/routes.test.ts  page.test.ts
packages/shared/src/constants.ts (+ not_ready, BIRTH_SIGN_METHODS)  schemas.ts (+ shareCreateSchema)  types.ts (+ ShareDto)
apps/frontend/Caddyfile (/s/* → backend)   apps/frontend/src/sw.ts (denylist /s/)
apps/*/Dockerfile (copy packages/ui)   .gitignore   eslint.config.mjs   OPERATIONS.md   README.md
```

---

### Task 1: Extract `packages/ui`

**Files:**
- Create: `packages/ui/package.json`, `tsconfig.json`, `vitest.config.ts`, `tailwind-preset.ts`, `src/index.ts`, `src/theme.css`, `src/test-setup.ts`, `src/ssr.test.tsx`
- Move (git mv, content unchanged except import paths): `apps/frontend/src/components/FortuneView.tsx`, `FortuneView.test.tsx`, `MethodCard.tsx`, `symbols/*` → `packages/ui/src/…`
- Modify: `apps/frontend/package.json`, `apps/frontend/tailwind.config.ts`, `apps/frontend/src/index.css`, `apps/frontend/src/pages/Today.tsx`, `FortuneDetail.tsx`, `History.tsx`, `apps/frontend/src/ritual/steps.tsx`, `apps/frontend/Dockerfile`

**Interfaces:**
- Produces `@third-eye/ui` exporting: `FortuneView({ fortune: FortuneDto })`, `MethodCard({ result })`, `MiniSymbols({ results })`, `TarotCard`, `RuneStone`, `Hexagram`, `SignRing`, `signItems`, `type SignItem` — identical signatures to today's frontend components.
- Produces `packages/ui/tailwind-preset.ts` (default export: Tailwind preset with the app theme) and `packages/ui/src/theme.css` (base `body`, `h1–h3`, and `.card`).

- [ ] **Step 1: Create the package skeleton**

`packages/ui/package.json`:
```json
{
  "name": "@third-eye/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit", "test": "vitest run" },
  "dependencies": {
    "@third-eye/divination": "workspace:*",
    "@third-eye/shared": "workspace:*"
  },
  "peerDependencies": { "react": "^18.3.1" },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

`packages/ui/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["@testing-library/jest-dom"] },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tailwind-preset.ts", "vitest.config.ts"]
}
```

`packages/ui/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
});
```

`packages/ui/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// No test.globals, so testing-library can't auto-register cleanup.
afterEach(() => { cleanup(); });
```

`packages/ui/tailwind-preset.ts` (the theme currently in `apps/frontend/tailwind.config.ts`, moved verbatim):
```ts
import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        night: '#0a0918', ink: '#13112a', veil: '#1e1b4b', mist: '#c7c3e6',
        gold: { DEFAULT: '#d4af37', soft: '#e9d8a6', deep: '#9c7c1c' },
      },
      fontFamily: { display: ['"Cormorant Garamond"', 'Georgia', 'serif'] },
      keyframes: { twinkle: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.9' } } },
      animation: { twinkle: 'twinkle 6s ease-in-out infinite' },
    },
  },
} satisfies Partial<Config>;
```

`packages/ui/src/theme.css` (moved from `apps/frontend/src/index.css`; only what the shared components and pages need):
```css
@layer base {
  body {
    @apply min-h-screen bg-night font-sans text-mist antialiased;
    background-image:
      radial-gradient(1px 1px at 20% 30%, rgb(255 255 255 / 0.5), transparent),
      radial-gradient(1px 1px at 70% 10%, rgb(255 255 255 / 0.4), transparent),
      radial-gradient(1.5px 1.5px at 85% 60%, rgb(233 216 166 / 0.5), transparent),
      radial-gradient(1px 1px at 35% 80%, rgb(255 255 255 / 0.35), transparent),
      radial-gradient(ellipse at top, #1e1b4b 0%, #0a0918 60%);
    background-attachment: fixed;
  }
  h1, h2, h3 { @apply font-display text-gold-soft; }
}

@layer components {
  .card { @apply rounded-2xl border border-gold/20 bg-ink/70 p-5 backdrop-blur; }
}
```

- [ ] **Step 2: Move the components and tests**

```bash
mkdir -p packages/ui/src/symbols
git mv apps/frontend/src/components/FortuneView.tsx packages/ui/src/FortuneView.tsx
git mv apps/frontend/src/components/FortuneView.test.tsx packages/ui/src/FortuneView.test.tsx
git mv apps/frontend/src/components/MethodCard.tsx packages/ui/src/MethodCard.tsx
for f in TarotCard RuneStone Hexagram SignRing; do git mv apps/frontend/src/components/symbols/$f.tsx packages/ui/src/symbols/$f.tsx; done
git mv apps/frontend/src/components/symbols/symbols.test.tsx packages/ui/src/symbols/symbols.test.tsx
```

Add `.js` extensions to the moved files' relative imports (nothing else changes):
- `packages/ui/src/FortuneView.tsx`: `from './MethodCard'` → `from './MethodCard.js'`
- `packages/ui/src/FortuneView.test.tsx`: `from './FortuneView'` → `from './FortuneView.js'`
- `packages/ui/src/MethodCard.tsx`: `'./symbols/TarotCard'` → `'./symbols/TarotCard.js'`, same for `RuneStone`, `Hexagram`, `SignRing`
- `packages/ui/src/symbols/symbols.test.tsx`: `'./TarotCard'` → `'./TarotCard.js'`, same for `RuneStone`, `Hexagram`, `SignRing`

`packages/ui/src/index.ts`:
```ts
export { FortuneView } from './FortuneView.js';
export { MethodCard, MiniSymbols } from './MethodCard.js';
export { TarotCard } from './symbols/TarotCard.js';
export { RuneStone } from './symbols/RuneStone.js';
export { Hexagram } from './symbols/Hexagram.js';
export { SignRing, signItems, type SignItem } from './symbols/SignRing.js';
```

- [ ] **Step 3: Write the server-render smoke test**

`packages/ui/src/ssr.test.tsx`:
```tsx
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FortuneDto } from '@third-eye/shared';
import { FortuneView } from './index.js';

const fortune: FortuneDto = {
  id: 'f1', date: '2026-09-29', status: 'READY', persona: 'CONFIDANT', summary: 'A gentle day.',
  results: [
    { method: 'TAROT', data: { cards: [
      { id: 'major-16', reversed: true, position: 'situation' },
      { id: 'cups-01', reversed: false, position: 'challenge' },
      { id: 'swords-12', reversed: false, position: 'advice' },
    ] }, reading: 'Let go.' },
    { method: 'RUNE', data: { id: 'ansuz', reversed: false }, reading: 'Listen.' },
    { method: 'ICHING', data: { lines: [9, 8, 7, 6, 7, 8], primary: 63, changingLines: [1, 4], relating: 17 }, reading: 'Finish well.' },
    { method: 'WESTERN', data: { sign: 'gemini' }, reading: 'Curious.' },
  ],
};

describe('server rendering', () => {
  it('renders the fortune view to static HTML without a DOM', () => {
    const html = renderToStaticMarkup(<FortuneView fortune={fortune} />);
    expect(html).toContain('A gentle day.');
    expect(html).toContain('The Tower (reversed)');
    expect(html).toContain('Ansuz');
    expect(html).toContain('<svg');
    expect(html).not.toContain('<script');
  });
});
```

- [ ] **Step 4: Install and run the ui tests**

Run: `pnpm install; pnpm --filter @third-eye/ui test; pnpm --filter @third-eye/ui typecheck`
Expected: all moved tests plus the SSR smoke test PASS; typecheck exits 0. If the SSR test fails because a component touches `window`/`document` during render, stop and report (the spec requires render-to-string safety).

- [ ] **Step 5: Point the frontend at `@third-eye/ui`**

`apps/frontend/package.json` — add to `dependencies`: `"@third-eye/ui": "workspace:*"`.

Update imports (and nothing else):
- `apps/frontend/src/pages/Today.tsx`: `import { FortuneView } from '../components/FortuneView';` → `import { FortuneView } from '@third-eye/ui';`
- `apps/frontend/src/pages/FortuneDetail.tsx`: same replacement.
- `apps/frontend/src/pages/History.tsx`: `import { MiniSymbols } from '../components/MethodCard';` → `import { MiniSymbols } from '@third-eye/ui';`
- `apps/frontend/src/ritual/steps.tsx`: replace the four `../components/symbols/*` imports with
  `import { Hexagram, RuneStone, SignRing, TarotCard, signItems } from '@third-eye/ui';`

`apps/frontend/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';
import preset from '../../packages/ui/tailwind-preset';

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  plugins: [],
} satisfies Config;
```

`apps/frontend/src/index.css` — replace the whole file with:
```css
@import '../../../packages/ui/src/theme.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn { @apply inline-flex min-h-11 items-center justify-center rounded-full px-5 font-medium transition disabled:opacity-40; }
  .btn-gold { @apply btn bg-gold text-night hover:bg-gold-soft active:bg-gold-deep; }
  .btn-ghost { @apply btn border border-gold/40 text-gold-soft hover:bg-gold/10; }
  .input { @apply min-h-11 w-full rounded-xl border border-gold/30 bg-night/60 px-3 text-mist placeholder:text-mist/40 focus:border-gold focus:outline-none; }
  .label { @apply mb-1 block text-sm font-medium text-gold-soft/90; }
  .field-error { @apply mt-1 text-sm text-rose-300; }
}
```

`apps/frontend/Dockerfile` — in the `deps` stage add `COPY packages/ui/package.json packages/ui/` next to the other package.json copies; in the `build` stage add `COPY packages/ui packages/ui` next to the other package copies.

- [ ] **Step 6: Verify nothing changed visually and everything passes**

Run: `pnpm install; pnpm test; pnpm typecheck; pnpm lint; pnpm --filter @third-eye/frontend build`
Expected: all green. Then compare the built CSS before/after for the theme: `grep -c "\.card" apps/frontend/dist/assets/*.css` ≥ 1 and the body background gradient is present (`grep -c "radial-gradient" apps/frontend/dist/assets/*.css` ≥ 1).

Run: `docker build -f apps/frontend/Dockerfile -t third-eye-frontend:ui-check .` → succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move fortune view and symbols into @third-eye/ui

Shared by the app and (next) the server-rendered share page. Theme moves
to a Tailwind preset + theme.css so both builds style them identically.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shares data model and signed-in API

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`; Create: `apps/backend/prisma/migrations/<timestamp>_shares/migration.sql` (generated)
- Modify: `packages/shared/src/constants.ts`, `constants.test.ts`, `schemas.ts`, `schemas.test.ts`, `types.ts`
- Create: `apps/backend/src/shares/service.ts`, `apps/backend/src/shares/routes.ts`, `apps/backend/src/shares/routes.test.ts`
- Modify: `apps/backend/src/app.ts`, `apps/backend/src/test/helpers/db.ts`

**Interfaces:**
- Produces (`@third-eye/shared`): `ERROR_CODES` includes `'not_ready'`; `BIRTH_SIGN_METHODS: readonly Method[]` = `['WESTERN','CHINESE','NUMEROLOGY','BLOODTYPE']`; `shareCreateSchema`, `type ShareCreateInput`; `interface ShareDto { id: string; url: string; sharedByName: string; includeBirthSigns: boolean; createdAt: string }`.
- Produces (backend `src/shares/service.ts`):
  ```ts
  export interface PublicShare { sharedByName: string; includeBirthSigns: boolean; fortune: FortuneDto }
  export interface ShareService {
    create(userSub: string, fortuneId: string, input: ShareCreateInput): Promise<ShareDto>;
    list(userSub: string, fortuneId: string): Promise<ShareDto[]>;
    revoke(userSub: string, shareId: string): Promise<void>;
    findPublic(token: string): Promise<PublicShare | null>;  // null for malformed/unknown/revoked; results filtered
  }
  export function createShareService(deps: { prisma: PrismaClient; frontendOrigin: string; newToken?: () => string }): ShareService;
  export const TOKEN_RE: RegExp;
  ```
- `buildApp` registers `registerShareRoutes(app, { shares })` and exposes the service for Task 3 via the same `shares` instance.

- [ ] **Step 1: Schema + migration**

Add to `apps/backend/prisma/schema.prisma`:
```prisma
model Share {
  id                String    @id @default(uuid()) @db.Uuid
  token             String    @unique
  fortuneId         String    @map("fortune_id") @db.Uuid
  userSub           String    @map("user_sub")
  sharedByName      String    @map("shared_by_name")
  includeBirthSigns Boolean   @default(false) @map("include_birth_signs")
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  revokedAt         DateTime? @map("revoked_at") @db.Timestamptz(6)
  fortune           Fortune   @relation(fields: [fortuneId], references: [id], onDelete: Cascade)
  user              User      @relation(fields: [userSub], references: [sub], onDelete: Cascade)

  @@index([fortuneId])
  @@map("shares")
}
```
Add the back-relations: in `model User` add `shares Share[]`; in `model Fortune` add `shares Share[]`.

Run:
```bash
docker compose up -d postgres
pnpm --filter @third-eye/backend prisma migrate dev --name shares
pnpm --filter @third-eye/backend test:db:setup
```
Expected: a new `…_shares/migration.sql` creating `shares` with the unique token index, the fortune index and both cascading FKs.

In `apps/backend/src/test/helpers/db.ts` `resetDatabase()`, add `await p.share.deleteMany();` as the **first** delete.

- [ ] **Step 2: Shared constants, schema and DTO — tests first**

In `packages/shared/src/constants.test.ts`, change the expected error-code list to:
```ts
      ['forbidden', 'internal', 'needs_onboarding', 'not_found', 'not_ready', 'rate_limited', 'unauthorized', 'validation_error'],
```
and add:
```ts
  it('lists the birth-based methods', () => {
    expect([...BIRTH_SIGN_METHODS]).toEqual(['WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE']);
  });
```
(add `BIRTH_SIGN_METHODS` to that file's import).

Append to `packages/shared/src/schemas.test.ts`:
```ts
describe('shareCreateSchema', () => {
  it('trims the name and requires a boolean', () => {
    expect(shareCreateSchema.parse({ sharedByName: '  Ada  ', includeBirthSigns: false })).toEqual({ sharedByName: 'Ada', includeBirthSigns: false });
  });
  it('rejects empty/overlong names, missing flags and unknown keys', () => {
    const bad = (v: unknown) => shareCreateSchema.safeParse(v).success;
    expect(bad({ sharedByName: '   ', includeBirthSigns: true })).toBe(false);
    expect(bad({ sharedByName: 'x'.repeat(61), includeBirthSigns: true })).toBe(false);
    expect(bad({ sharedByName: 'Ada' })).toBe(false);
    expect(bad({ sharedByName: 'Ada', includeBirthSigns: true, extra: 1 })).toBe(false);
  });
});
```
(add `shareCreateSchema` to that file's import).

Run: `pnpm --filter @third-eye/shared test` → FAIL.

Implement:
- `packages/shared/src/constants.ts`: insert `'not_ready',` into `ERROR_CODES` (after `'needs_onboarding'`), and add:
  ```ts
  import type { Method } from '@third-eye/divination';
  /** Hidden on a share link unless the owner opts in. */
  export const BIRTH_SIGN_METHODS: readonly Method[] = ['WESTERN', 'CHINESE', 'NUMEROLOGY', 'BLOODTYPE'];
  ```
  (put the import at the top of the file).
- `packages/shared/src/schemas.ts`, append:
  ```ts
  export const shareCreateSchema = z.object({
    sharedByName: z.string().trim().min(1, 'Enter a name').max(60),
    includeBirthSigns: z.boolean(),
  }).strict();
  export type ShareCreateInput = z.infer<typeof shareCreateSchema>;
  ```
- `packages/shared/src/types.ts`, append:
  ```ts
  export interface ShareDto {
    id: string;
    url: string;               // `${FRONTEND_ORIGIN}/s/${token}`
    sharedByName: string;
    includeBirthSigns: boolean;
    createdAt: string;         // ISO timestamp
  }
  ```

Run: `pnpm --filter @third-eye/shared test` → PASS.

- [ ] **Step 3: Write the failing route tests**

`apps/backend/src/shares/routes.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase, seedFortune } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(resetDatabase);

const body = { sharedByName: 'Ada', includeBirthSigns: false };

describe('share routes', () => {
  it('creates, lists and revokes a share for a READY fortune', async () => {
    const u = await ctx.user();
    const f = await seedFortune(ctx.prisma, u.sub, { status: 'READY' });
    const created = await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, body);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ sharedByName: 'Ada', includeBirthSigns: false });
    expect(created.body.data.url).toMatch(/^http:\/\/localhost:5174\/s\/[A-Za-z0-9_-]{22}$/);

    const second = await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, { sharedByName: 'Dad', includeBirthSigns: true });
    const list = await ctx.call(u, 'GET', `/api/fortunes/${f.id}/shares`);
    expect(list.body.data.map((s: any) => s.sharedByName)).toEqual(['Dad', 'Ada']);

    expect((await ctx.call(u, 'DELETE', `/api/shares/${second.body.data.id}`)).status).toBe(204);
    const after = await ctx.call(u, 'GET', `/api/fortunes/${f.id}/shares`);
    expect(after.body.data.map((s: any) => s.sharedByName)).toEqual(['Ada']);
    expect((await ctx.call(u, 'DELETE', `/api/shares/${second.body.data.id}`)).status).toBe(404);
  });

  it('refuses unfinished fortunes with 409 not_ready', async () => {
    const u = await ctx.user();
    const f = await seedFortune(ctx.prisma, u.sub, { status: 'PENDING' });
    const r = await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, body);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('not_ready');
  });

  it("404s on other users' fortunes and shares", async () => {
    const a = await ctx.user(); const b = await ctx.user();
    const f = await seedFortune(ctx.prisma, b.sub, { status: 'READY' });
    expect((await ctx.call(a, 'POST', `/api/fortunes/${f.id}/shares`, body)).status).toBe(404);
    expect((await ctx.call(a, 'GET', `/api/fortunes/${f.id}/shares`)).status).toBe(404);
    const s = await ctx.call(b, 'POST', `/api/fortunes/${f.id}/shares`, body);
    expect((await ctx.call(a, 'DELETE', `/api/shares/${s.body.data.id}`)).status).toBe(404);
    expect((await ctx.call(a, 'DELETE', '/api/shares/not-a-uuid')).status).toBe(404);
  });

  it('validates the body and requires a session and same origin', async () => {
    const u = await ctx.user();
    const f = await seedFortune(ctx.prisma, u.sub, { status: 'READY' });
    expect((await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, { sharedByName: '' , includeBirthSigns: true })).status).toBe(400);
    expect((await ctx.call(null, 'POST', `/api/fortunes/${f.id}/shares`, body)).status).toBe(401);
    expect((await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, body, { origin: 'https://evil.example' })).status).toBe(403);
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/shares` → FAIL (404s).

- [ ] **Step 4: Implement the service and routes**

`apps/backend/src/shares/service.ts`:
```ts
import { randomBytes } from 'node:crypto';
import type { PrismaClient, Share } from '@prisma/client';
import { BIRTH_SIGN_METHODS, type FortuneDto, type ShareCreateInput, type ShareDto } from '@third-eye/shared';
import { AppError, notFound } from '../errors.js';
import { serializeFortune } from '../fortunes/serialize.js';

export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
export interface PublicShare { sharedByName: string; includeBirthSigns: boolean; fortune: FortuneDto }
export interface ShareService {
  create(userSub: string, fortuneId: string, input: ShareCreateInput): Promise<ShareDto>;
  list(userSub: string, fortuneId: string): Promise<ShareDto[]>;
  revoke(userSub: string, shareId: string): Promise<void>;
  findPublic(token: string): Promise<PublicShare | null>;
}

export function createShareService(deps: {
  prisma: PrismaClient; frontendOrigin: string; newToken?: () => string;
}): ShareService {
  const { prisma } = deps;
  const newToken = deps.newToken ?? (() => randomBytes(16).toString('base64url'));
  const toDto = (s: Share): ShareDto => ({
    id: s.id, url: `${deps.frontendOrigin}/s/${s.token}`, sharedByName: s.sharedByName,
    includeBirthSigns: s.includeBirthSigns, createdAt: s.createdAt.toISOString(),
  });

  async function ownFortune(userSub: string, fortuneId: string) {
    const f = await prisma.fortune.findFirst({ where: { id: fortuneId, userSub } });
    if (!f) throw notFound();
    return f;
  }

  return {
    async create(userSub, fortuneId, input) {
      const f = await ownFortune(userSub, fortuneId);
      if (f.status !== 'READY') throw new AppError(409, 'not_ready', "This reading isn't finished yet");
      const s = await prisma.share.create({
        data: { token: newToken(), fortuneId, userSub, sharedByName: input.sharedByName, includeBirthSigns: input.includeBirthSigns },
      });
      return toDto(s);
    },

    async list(userSub, fortuneId) {
      await ownFortune(userSub, fortuneId);
      const rows = await prisma.share.findMany({
        where: { fortuneId, userSub, revokedAt: null }, orderBy: { createdAt: 'desc' },
      });
      return rows.map(toDto);
    },

    async revoke(userSub, shareId) {
      const r = await prisma.share.updateMany({
        where: { id: shareId, userSub, revokedAt: null }, data: { revokedAt: new Date() },
      });
      if (r.count !== 1) throw notFound();
    },

    async findPublic(token) {
      if (!TOKEN_RE.test(token)) return null;
      const s = await prisma.share.findUnique({ where: { token }, include: { fortune: { include: { results: true } } } });
      if (!s || s.revokedAt || s.fortune.status !== 'READY') return null;
      const fortune = serializeFortune(s.fortune);
      if (!s.includeBirthSigns) fortune.results = fortune.results.filter((r) => !BIRTH_SIGN_METHODS.includes(r.method));
      return { sharedByName: s.sharedByName, includeBirthSigns: s.includeBirthSigns, fortune };
    },
  };
}
```

`apps/backend/src/shares/routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { shareCreateSchema } from '@third-eye/shared';
import { parse } from '../errors.js';
import { uuidParam } from '../lib/ids.js';
import type { ShareService } from './service.js';

export function registerShareRoutes(app: FastifyInstance, deps: { shares: ShareService }): void {
  const auth = { preHandler: app.requireAuth };

  app.post<{ Params: { id: string } }>('/api/fortunes/:id/shares',
    { ...auth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const input = parse(shareCreateSchema, req.body);
      const data = await deps.shares.create(req.user!.sub, uuidParam(req.params.id), input);
      return reply.code(201).send({ data });
    });

  app.get<{ Params: { id: string } }>('/api/fortunes/:id/shares', auth, async (req) => ({
    data: await deps.shares.list(req.user!.sub, uuidParam(req.params.id)),
  }));

  app.delete<{ Params: { id: string } }>('/api/shares/:id', auth, async (req, reply) => {
    await deps.shares.revoke(req.user!.sub, uuidParam(req.params.id));
    return reply.code(204).send();
  });
}
```

In `apps/backend/src/app.ts`: add imports
```ts
import { createShareService } from './shares/service.js';
import { registerShareRoutes } from './shares/routes.js';
```
and immediately after `registerFortuneRoutes(app, { fortunes });` add:
```ts
  const shares = createShareService({ prisma: options.prisma, frontendOrigin: options.frontendOrigin });
  registerShareRoutes(app, { shares });
```

- [ ] **Step 5: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @third-eye/backend test; pnpm test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0.

```bash
git add -A
git commit -m "feat(shares): share links table and create/list/revoke API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Public server-rendered share page

**Files:**
- Modify: `apps/backend/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `apps/backend/Dockerfile`, `apps/backend/src/app.ts`
- Create: `apps/backend/scripts/build-share-css.mjs`, `apps/backend/tailwind.share.config.ts`, `apps/backend/src/shares/share.css`, `apps/backend/src/shares/fonts.ts`, `apps/backend/src/shares/page.tsx`, `apps/backend/src/shares/public-routes.ts`, `apps/backend/src/shares/page.test.ts`
- Modify: `.gitignore`, `eslint.config.mjs`, `apps/frontend/Caddyfile`, `apps/frontend/src/sw.ts`

**Interfaces:**
- Consumes: `ShareService.findPublic`, `PublicShare` (Task 2); `FortuneView` (Task 1).
- Produces: `renderSharePage(share: PublicShare): string`, `renderNotFoundPage(): string`, `shareDescription(fortune: FortuneDto): string`, `registerPublicShareRoutes(app, { shares })`, `SHARE_PAGE_HEADERS`.

- [ ] **Step 1: Backend React/JSX + CSS generation plumbing**

Run:
```bash
pnpm --filter @third-eye/backend add react react-dom @third-eye/ui@workspace:* @fontsource/cormorant-garamond
pnpm --filter @third-eye/backend add -D @types/react @types/react-dom tailwindcss
```

`apps/backend/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["node"], "jsx": "react-jsx" }, "include": ["src/**/*.ts", "src/**/*.tsx", "tsup.config.ts", "vitest.config.ts", "tailwind.share.config.ts"] }
```

`apps/backend/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  noExternal: ['@third-eye/shared', '@third-eye/divination', '@third-eye/ui'],
  esbuildOptions(o) { o.jsx = 'automatic'; },
  sourcemap: true,
  clean: true,
});
```

`apps/backend/vitest.config.ts` — add `esbuild: { jsx: 'automatic' },` at the top level of `defineConfig({...})` (sibling of `test`).

`apps/backend/tailwind.share.config.ts`:
```ts
import type { Config } from 'tailwindcss';
import preset from '../../packages/ui/tailwind-preset';

export default {
  presets: [preset],
  content: ['../../packages/ui/src/**/*.{ts,tsx}', './src/shares/**/*.tsx'],
  corePlugins: { preflight: true },
} satisfies Config;
```

`apps/backend/src/shares/share.css`:
```css
@import '../../../../packages/ui/src/theme.css';

@font-face { font-family: 'Cormorant Garamond'; font-style: normal; font-weight: 400; font-display: swap;
  src: url('/s/assets/cormorant-400.woff2') format('woff2'); }
@font-face { font-family: 'Cormorant Garamond'; font-style: normal; font-weight: 600; font-display: swap;
  src: url('/s/assets/cormorant-600.woff2') format('woff2'); }

@tailwind base;
@tailwind components;
@tailwind utilities;
```

`apps/backend/scripts/build-share-css.mjs`:
```js
// Builds the share page's stylesheet with Tailwind and writes it as a TS module the page inlines.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const cli = join(dirname(require.resolve('tailwindcss/package.json')), 'lib', 'cli.js');
const css = execFileSync(process.execPath, [cli, '-c', 'tailwind.share.config.ts', '-i', 'src/shares/share.css', '--minify'],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const outDir = join(root, 'src', 'shares', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'share-css.ts'), `// Generated by scripts/build-share-css.mjs — do not edit.\nexport const SHARE_CSS = ${JSON.stringify(css)};\n`);
console.log(`share.css: ${css.length} bytes`);
```

`apps/backend/package.json` scripts — replace these four:
```json
    "dev": "node scripts/build-share-css.mjs && dotenv -e ../../.env -- tsx watch src/server.ts",
    "build": "node scripts/build-share-css.mjs && tsup",
    "test": "node scripts/build-share-css.mjs && vitest run",
    "typecheck": "node scripts/build-share-css.mjs && tsc -p tsconfig.json --noEmit",
```

`.gitignore` — add a line `apps/backend/src/shares/generated/`.
`eslint.config.mjs` — add `'apps/backend/src/shares/generated/**'` to the top-level `ignores` array.

Run: `node apps/backend/scripts/build-share-css.mjs`
Expected: prints `share.css: N bytes` with N under ~25000, and creates `apps/backend/src/shares/generated/share-css.ts`. `grep -c "\.card" apps/backend/src/shares/generated/share-css.ts` ≥ 1.

- [ ] **Step 2: Write the failing page tests**

`apps/backend/src/shares/page.test.ts`:
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestCtx } from '../test/helpers/test-app.js';
import { resetDatabase, seedFortune } from '../test/helpers/db.js';

let ctx: TestCtx;
beforeAll(async () => { ctx = await createTestApp(); });
afterAll(async () => { await ctx.close(); });
beforeEach(resetDatabase);

async function share(opts: { includeBirthSigns?: boolean; name?: string } = {}) {
  const u = await ctx.user();
  const f = await seedFortune(ctx.prisma, u.sub, { status: 'READY', bloodType: 'O', date: '2026-09-29', summary: 'A gentle day.' });
  const r = await ctx.call(u, 'POST', `/api/fortunes/${f.id}/shares`, {
    sharedByName: opts.name ?? 'Ada', includeBirthSigns: opts.includeBirthSigns ?? false,
  });
  const token = (r.body.data.url as string).split('/s/')[1]!;
  return { u, f, token, id: r.body.data.id as string };
}
const page = (token: string) => ctx.app.inject({ method: 'GET', url: `/s/${token}` });

describe('public share page', () => {
  it('renders the fortune as static HTML with the right headers', async () => {
    const { token } = await share();
    const r = await page(token);
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-robots-tag']).toBe('noindex');
    expect(r.headers['referrer-policy']).toBe('no-referrer');
    expect(r.headers['content-security-policy']).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(r.body.startsWith('<!doctype html>')).toBe(true);
    expect(r.body).toContain('Shared by Ada');
    expect(r.body).toContain('Tuesday, September 29');
    expect(r.body).toContain('The Confidant');
    expect(r.body).toContain('A gentle day.');
    expect(r.body).toContain('Tarot');
    expect(r.body).not.toMatch(/<script/i);
  });

  it('hides birth-based methods unless the share includes them', async () => {
    const hidden = await page((await share({ includeBirthSigns: false })).token);
    expect(hidden.body).not.toContain('Sun Sign');
    expect(hidden.body).not.toContain('Blood Type');
    await resetDatabase();
    const shown = await page((await share({ includeBirthSigns: true })).token);
    expect(shown.body).toContain('Sun Sign');
    expect(shown.body).toContain('Chinese Zodiac');
    expect(shown.body).toContain('Numerology');
    expect(shown.body).toContain('Blood Type');
  });

  it('emits link-preview tags', async () => {
    const { token } = await share();
    const html = (await page(token)).body;
    expect(html).toContain('<meta property="og:title" content="Ada&#x27;s fortune — Sep 29"/>');
    expect(html).toMatch(/<meta property="og:description" content="[^"]+ · [^"]+ · Hexagram \d+: [^"]+"\/>/);
    expect(html).toContain('<meta property="og:site_name" content="Third Eye"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary"/>');
    expect(html).toContain('<meta name="robots" content="noindex"/>');
  });

  it('escapes the shared-by name', async () => {
    const { token } = await share({ name: '<script>alert(1)</script>' });
    const html = (await page(token)).body;
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('shows the same 404 page for revoked, unknown and malformed tokens', async () => {
    const { u, token, id } = await share();
    await ctx.call(u, 'DELETE', `/api/shares/${id}`);
    for (const t of [token, 'A'.repeat(22), 'bad']) {
      const r = await page(t);
      expect(r.statusCode).toBe(404);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.body).toContain('This link is no longer active');
      expect(r.body).not.toMatch(/<script/i);
    }
  });

  it('serves the two fonts with immutable caching and nothing else', async () => {
    const f = await ctx.app.inject({ method: 'GET', url: '/s/assets/cormorant-400.woff2' });
    expect(f.statusCode).toBe(200);
    expect(f.headers['content-type']).toBe('font/woff2');
    expect(f.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(f.rawPayload.length).toBeGreaterThan(1000);
    expect((await ctx.app.inject({ method: 'GET', url: '/s/assets/..%2F..%2Fpackage.json' })).statusCode).toBe(404);
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/shares/page.test.ts` → FAIL (404 JSON for `/s/...`).

- [ ] **Step 3: Implement fonts, page and routes**

`apps/backend/src/shares/fonts.ts`:
```ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FILES: Record<string, string> = {
  'cormorant-400.woff2': '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2',
  'cormorant-600.woff2': '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2',
};
const cache = new Map<string, Buffer>();

/** The font bytes for an allow-listed file name, or null. */
export function shareFont(name: string): Buffer | null {
  const spec = FILES[name];
  if (!spec) return null;
  let buf = cache.get(name);
  if (!buf) { buf = readFileSync(require.resolve(spec)); cache.set(name, buf); }
  return buf;
}
```

`apps/backend/src/shares/page.tsx`:
```tsx
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getHexagram, getRune, getTarotCard, type IChingData, type RuneData, type TarotData } from '@third-eye/divination';
import type { FortuneDto } from '@third-eye/shared';
import { FortuneView } from '@third-eye/ui';
import { SHARE_CSS } from './generated/share-css.js';
import type { PublicShare } from './service.js';

const noon = (date: string) => new Date(`${date}T12:00:00Z`);
const longDate = (date: string) =>
  noon(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const shortDate = (date: string) =>
  noon(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "The Tower (reversed), Ace of Cups, Knight of Swords · Ansuz · Hexagram 23: Splitting Apart" */
export function shareDescription(fortune: FortuneDto): string {
  const parts: string[] = [];
  for (const r of fortune.results) {
    if (r.method === 'TAROT') {
      parts.push((r.data as TarotData).cards
        .map((c) => `${getTarotCard(c.id).name}${c.reversed ? ' (reversed)' : ''}`).join(', '));
    } else if (r.method === 'RUNE') {
      const d = r.data as RuneData;
      parts.push(`${getRune(d.id).name}${d.reversed ? ' (reversed)' : ''}`);
    } else if (r.method === 'ICHING') {
      const n = (r.data as IChingData).primary;
      parts.push(`Hexagram ${n}: ${getHexagram(n).name}`);
    }
  }
  return parts.join(' · ');
}

function Page({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#0a0918" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <meta property="og:title" content={title} />
        {description && <meta property="og:description" content={description} />}
        <meta property="og:site_name" content="Third Eye" />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary" />
        <style dangerouslySetInnerHTML={{ __html: SHARE_CSS }} />
      </head>
      <body>
        <main className="mx-auto max-w-lg px-4 py-8">
          <p className="text-center font-display text-2xl text-gold-soft">Third Eye</p>
          {children}
          <footer className="mt-10 text-center text-xs text-mist/40">Third Eye — for reflection and entertainment.</footer>
        </main>
      </body>
    </html>
  );
}

const doc = (el: ReactElement) => `<!doctype html>${renderToStaticMarkup(el)}`;

export function renderSharePage(share: PublicShare): string {
  const { fortune, sharedByName } = share;
  return doc(
    <Page title={`${sharedByName}'s fortune — ${shortDate(fortune.date)}`} description={shareDescription(fortune)}>
      <header className="mb-6 mt-4 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-mist/50">{longDate(fortune.date)}</p>
        <h1 className="mt-1 text-3xl">Shared by {sharedByName}</h1>
      </header>
      <FortuneView fortune={fortune} />
    </Page>,
  );
}

export function renderNotFoundPage(): string {
  return doc(
    <Page title="Third Eye">
      <section className="card mt-10 text-center">
        <h1 className="text-3xl">This link is no longer active</h1>
        <p className="mt-3 text-mist/70">The person who shared it may have stopped sharing.</p>
      </section>
    </Page>,
  );
}
```

`apps/backend/src/shares/public-routes.ts`:
```ts
import type { FastifyInstance } from 'fastify';
import { shareFont } from './fonts.js';
import { renderNotFoundPage, renderSharePage } from './page.js';
import type { ShareService } from './service.js';

export const SHARE_PAGE_HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
} as const;

export function registerPublicShareRoutes(app: FastifyInstance, deps: { shares: ShareService }): void {
  app.get<{ Params: { file: string } }>('/s/assets/:file', async (req, reply) => {
    const font = shareFont(req.params.file);
    if (!font) {
      return reply.code(404).headers(SHARE_PAGE_HEADERS).type('text/html; charset=utf-8').send(renderNotFoundPage());
    }
    return reply
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .type('font/woff2').send(font);
  });

  app.get<{ Params: { token: string } }>('/s/:token',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const share = await deps.shares.findPublic(req.params.token);
      reply.headers(SHARE_PAGE_HEADERS).type('text/html; charset=utf-8');
      if (!share) return reply.code(404).send(renderNotFoundPage());
      return reply.send(renderSharePage(share));
    });
}
```

In `apps/backend/src/app.ts`, add `import { registerPublicShareRoutes } from './shares/public-routes.js';` and after `registerShareRoutes(app, { shares });` add `registerPublicShareRoutes(app, { shares });`.

Run: `pnpm --filter @third-eye/backend exec vitest run src/shares` → PASS.
If the og:title assertion fails only because React escapes the apostrophe differently (e.g. `&#39;`), update the expected string in the test to React's actual output — the requirement is "escaped", not a specific entity.

- [ ] **Step 4: Routing, service worker, Docker**

`apps/frontend/Caddyfile` — add this block immediately **before** the existing `handle /assets/* {` block:
```caddyfile
  # Public share pages are rendered by the backend and set their own (stricter) security headers.
  handle /s/* {
    reverse_proxy backend:3000
  }
```

`apps/frontend/src/sw.ts` — change the navigation denylist to `{ denylist: [/^\/api\//, /^\/s\//] }`.

`apps/backend/Dockerfile` — in the `deps` stage add `COPY packages/ui/package.json packages/ui/` next to the other package.json copies; in the `build` stage add `COPY packages/ui packages/ui` next to the other package copies. (The build script runs inside `pnpm --filter @third-eye/backend build`, so `share.css` is generated in the image; fonts ship via `apps/backend/node_modules`.)

- [ ] **Step 5: Verify end to end, commit**

Run: `pnpm test; pnpm typecheck; pnpm lint; pnpm build`
Expected: all green.

Run: `docker build -f apps/backend/Dockerfile -t third-eye-backend:share-check . && docker build -f apps/frontend/Dockerfile -t third-eye-frontend:share-check .`
Expected: both build.

Manual (dev): `pnpm dev`, sign in via `http://localhost:5174/api/auth/dev-login?sub=dev`, then in another terminal create a share with curl using the dev cookie (or via Task 4's UI once built) and open `http://localhost:3001/s/<token>` directly — the page renders in the dark theme with fonts, no console errors, and View Source shows no `<script>`.

```bash
git add -A
git commit -m "feat(shares): server-rendered public share page

Static HTML from the shared React components, inlined build-time Tailwind
CSS, self-hosted fonts, OG tags, strict CSP, no-store, noindex.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Share dialog in the app + docs

**Files:**
- Modify: `apps/frontend/src/api.ts`, `apps/frontend/src/pages/Today.tsx`, `apps/frontend/src/pages/FortuneDetail.tsx`
- Create: `apps/frontend/src/components/ShareDialog.tsx`, `apps/frontend/src/components/ShareDialog.test.tsx`
- Modify: `OPERATIONS.md`, `README.md`

**Interfaces:**
- Consumes: `ShareDto`, `ShareCreateInput`, `shareCreateSchema` (`@third-eye/shared`); API routes from Task 2.
- Produces: RTK hooks `useGetSharesQuery(fortuneId)`, `useCreateShareMutation()`, `useRevokeShareMutation()`; `ShareButton({ fortuneId })` (renders the button + dialog).

- [ ] **Step 1: API endpoints**

In `apps/frontend/src/api.ts`:
- Add `ShareCreateInput, ShareDto` to the `@third-eye/shared` type import.
- Change `tagTypes` to `['Me', 'Fortune', 'History', 'Shares']`.
- Add endpoints inside `endpoints: (b) => ({ ... })`:
```ts
    getShares: b.query<ShareDto[], string>({
      query: (fortuneId) => `/fortunes/${fortuneId}/shares`,
      providesTags: (_r, _e, fortuneId) => [{ type: 'Shares', id: fortuneId }],
    }),
    createShare: b.mutation<ShareDto, { fortuneId: string } & ShareCreateInput>({
      query: ({ fortuneId, ...body }) => ({ url: `/fortunes/${fortuneId}/shares`, method: 'POST', body }),
      invalidatesTags: (_r, _e, a) => [{ type: 'Shares', id: a.fortuneId }],
    }),
    revokeShare: b.mutation<void, { id: string; fortuneId: string }>({
      query: ({ id }) => ({ url: `/shares/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, a) => [{ type: 'Shares', id: a.fortuneId }],
    }),
```
- Add `useGetSharesQuery, useCreateShareMutation, useRevokeShareMutation` to the exported hooks.

- [ ] **Step 2: Write the failing dialog tests**

`apps/frontend/src/components/ShareDialog.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShareDto } from '@third-eye/shared';
import { installMockApi, ok } from '../test/mockApi';
import { me, renderApp } from '../test/render';
import { ShareButton } from './ShareDialog';

const FID = '11111111-1111-4111-8111-111111111111';
const share = (over: Partial<ShareDto> = {}): ShareDto => ({
  id: 'a1b2c3d4-0000-4000-8000-000000000001', url: 'https://third-eye.example/s/AAAAAAAAAAAAAAAAAAAAAA',
  sharedByName: 'Ada Lovelace', includeBirthSigns: false, createdAt: '2026-09-29T12:00:00.000Z', ...over,
});

describe('ShareButton', () => {
  it('pre-fills the name from the profile, defaults signs off, and creates a link', async () => {
    let shares: ShareDto[] = [];
    const calls = installMockApi({
      'GET /me': ok(me({ profile: { ...me().profile, fullName: 'Ada Lovelace' } })),
      [`GET /fortunes/${FID}/shares`]: () => ok(shares),
      [`POST /fortunes/${FID}/shares`]: ({ body }) => { shares = [share(body as Partial<ShareDto>)]; return ok(shares[0], 201); },
    });
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Shared by')).toHaveValue('Ada Lovelace');
    expect(within(dialog).getByLabelText(/include birth-based signs/i)).not.toBeChecked();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create link' }));
    // The new link shows under the button and again in the refreshed "Active links" list.
    expect((await within(dialog).findAllByDisplayValue('https://third-eye.example/s/AAAAAAAAAAAAAAAAAAAAAA')).length).toBeGreaterThan(0);
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ sharedByName: 'Ada Lovelace', includeBirthSigns: false });
  });

  it('falls back to the account name and lists existing links, which can be revoked', async () => {
    let shares = [share({ sharedByName: 'Dad', includeBirthSigns: true })];
    installMockApi({
      'GET /me': ok(me()),
      [`GET /fortunes/${FID}/shares`]: () => ok(shares),
      // The mock can't build a 204 Response with a body, so answer 200 {} — RTK treats both as success.
      [`DELETE /shares/${shares[0]!.id}`]: () => { shares = []; return { status: 200, body: {} }; },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Shared by')).toHaveValue('Ada');
    expect(await within(dialog).findByText(/Dad · with signs/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop sharing' }));
    await waitFor(() => expect(within(dialog).queryByText(/Dad · with signs/)).not.toBeInTheDocument());
  });

  it('shows the server error inline', async () => {
    installMockApi({
      'GET /me': ok(me()),
      [`GET /fortunes/${FID}/shares`]: ok([]),
      [`POST /fortunes/${FID}/shares`]: { status: 409, body: { error: { code: 'not_ready', message: 'x' } } },
    });
    renderApp(<ShareButton fortuneId={FID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create link' }));
    expect(await screen.findByText("This reading isn't finished yet.")).toBeInTheDocument();
  });
});
```
Note: `me()` in `src/test/render.tsx` has `user.name: 'Ada'` and `profile.fullName: null`.

Run: `pnpm --filter @third-eye/frontend test` → FAIL (cannot resolve `./ShareDialog`).

- [ ] **Step 3: Implement the dialog**

`apps/frontend/src/components/ShareDialog.tsx`:
```tsx
import { useState } from 'react';
import { shareCreateSchema, type ShareDto } from '@third-eye/shared';
import { apiErrorCode, useCreateShareMutation, useGetMeQuery, useGetSharesQuery, useRevokeShareMutation } from '../api';

function LinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={url} aria-label="Share link" className="input min-w-0 flex-1 text-sm" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn-ghost" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* clipboard blocked: the field is selectable */ }
      }}>{copied ? 'Copied' : 'Copy'}</button>
      {canShare && (
        <button type="button" className="btn-ghost" onClick={() => { void navigator.share({ title: 'A Third Eye fortune', url }).catch(() => {}); }}>
          Share…
        </button>
      )}
    </div>
  );
}

function ShareDialog({ fortuneId, onClose }: { fortuneId: string; onClose: () => void }) {
  const { data: me } = useGetMeQuery();
  const { data: shares = [] } = useGetSharesQuery(fortuneId);
  const [createShare, { isLoading: creating }] = useCreateShareMutation();
  const [revokeShare] = useRevokeShareMutation();
  const [name, setName] = useState(me?.profile.fullName ?? me?.user.name ?? '');
  const [includeBirthSigns, setIncludeBirthSigns] = useState(false);
  const [created, setCreated] = useState<ShareDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    const parsed = shareCreateSchema.safeParse({ sharedByName: name, includeBirthSigns });
    if (!parsed.success) { setError('Enter a name of 1–60 characters.'); return; }
    try {
      setCreated(await createShare({ fortuneId, ...parsed.data }).unwrap());
    } catch (err) {
      setError(apiErrorCode(err) === 'not_ready' ? "This reading isn't finished yet." : 'Could not create the link. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/80 p-4 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="card grid w-full max-w-md gap-4" onClick={(e) => e.stopPropagation()}>
        <h2 id="share-title" className="text-2xl">Share this fortune</h2>
        <div>
          <label className="label" htmlFor="share-name">Shared by</label>
          <input id="share-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={includeBirthSigns} onChange={(e) => setIncludeBirthSigns(e.target.checked)}
            aria-describedby="share-signs-hint" aria-label="Include birth-based signs" />
          <span>
            Include birth-based signs
            <span id="share-signs-hint" className="block text-mist/60">
              Adds your sun sign, Chinese zodiac, numbers and blood type. The written summary may still mention them.
            </span>
          </span>
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="button" className="btn-gold" disabled={creating} onClick={() => void create()}>Create link</button>
        {created && <LinkRow url={created.url} />}
        {shares.length > 0 && (
          <section className="grid gap-3">
            <h3 className="text-lg">Active links</h3>
            {shares.map((s) => (
              <div key={s.id} className="grid gap-2 rounded-xl border border-gold/15 p-3">
                <p className="text-sm text-mist/80">
                  {s.sharedByName} · {s.includeBirthSigns ? 'with signs' : 'without signs'} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
                <LinkRow url={s.url} />
                <button type="button" className="btn-ghost justify-self-start text-sm" onClick={() => {
                  if (window.confirm('Stop sharing this link? Anyone who has it will no longer be able to open it.')) {
                    void revokeShare({ id: s.id, fortuneId });
                  }
                }}>Stop sharing</button>
              </div>
            ))}
          </section>
        )}
        <button type="button" className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function ShareButton({ fortuneId }: { fortuneId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost mx-auto" onClick={() => setOpen(true)}>Share</button>
      {open && <ShareDialog fortuneId={fortuneId} onClose={() => setOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 4: Put the button on Today and History detail**

`apps/frontend/src/pages/Today.tsx` — add `import { ShareButton } from '../components/ShareDialog';` and replace the READY block:
```tsx
      {fortune.status === 'READY' && (
        <button className="btn-ghost mx-auto" onClick={() => setRitual(true)}>Replay the ritual</button>
      )}
```
with:
```tsx
      {fortune.status === 'READY' && (
        <div className="flex flex-wrap justify-center gap-3">
          <ShareButton fortuneId={fortune.id} />
          <button className="btn-ghost" onClick={() => setRitual(true)}>Replay the ritual</button>
        </div>
      )}
```

`apps/frontend/src/pages/FortuneDetail.tsx` — add `import { ShareButton } from '../components/ShareDialog';` and after `<FortuneView fortune={data} />` add:
```tsx
      {data.status === 'READY' && <ShareButton fortuneId={data.id} />}
```

- [ ] **Step 5: Docs**

`README.md` — after the "Live (family & friends…)" line add:
`Any finished reading can be shared with people who don't have an account: **Share** creates a read-only link (optionally without your birth-based signs) that you can stop sharing at any time.`

`OPERATIONS.md` — in "Day-2 operations", add:
```markdown
**Share links:** users create and revoke them in the app (Share → Stop sharing). Public pages live at `/s/<token>`,
are rendered by the backend (Caddy routes `/s/*` to it), never cached (`no-store`) and not indexed (`noindex`).
To list active links:
```bash
docker exec shared-infra-postgresql-1 psql -U postgres -d third_eye -c \
  "SELECT s.created_at, s.user_sub, s.shared_by_name, s.include_birth_signs, f.date FROM shares s JOIN fortunes f ON f.id = s.fortune_id WHERE s.revoked_at IS NULL ORDER BY s.created_at DESC;"
```
To revoke one by hand: `UPDATE shares SET revoked_at = now() WHERE token = '<token>';`
```
(The inner bash fence is part of the markdown being inserted.)

- [ ] **Step 6: Run everything, commit**

Run: `pnpm test; pnpm typecheck; pnpm lint; pnpm build`
Expected: all green.

Manual (dev): `pnpm dev` → dev-login → open today's fortune → **Share** → create a link without signs → open it in a private window (should render, no birth cards) → create another with signs → both listed → Stop sharing one → reload its page → "no longer active".

```bash
git add -A
git commit -m "feat(frontend): share dialog with per-link name, signs toggle and revoke

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
