# Third Eye — Part 4: Frontend (Tasks 17–22)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Read the index first: [2026-09-26-third-eye.md](2026-09-26-third-eye.md). This part depends on Parts 1–3 (it consumes the API and `@third-eye/divination` data). Frontend test command: `pnpm --filter @third-eye/frontend test`.

**Look and feel (spec §7):** mobile-first, dark celestial — near-black/indigo background with a faint starfield, gold accents, Cormorant Garamond for headings (self-hosted via `@fontsource`, because the CSP allows only `'self'` fonts), system sans for body text. Every animation respects `prefers-reduced-motion` via `useReducedMotion()` from `motion/react`.

---

### Task 17: Frontend scaffold — theme, API slice, routing, auth gate

**Files:**
- Create: `apps/frontend/package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.cjs`, `index.html`, `public/favicon.svg`
- Create: `apps/frontend/src/main.tsx`, `App.tsx`, `store.ts`, `api.ts`, `index.css`, `test-setup.ts`, `src/test/mockApi.ts`, `src/test/render.tsx`
- Create: `apps/frontend/src/components/Layout.tsx`, `apps/frontend/src/components/Screen.tsx`
- Create (placeholders replaced in later tasks): `src/pages/Welcome.tsx`, `Today.tsx`, `History.tsx`, `FortuneDetail.tsx`, `Settings.tsx`
- Test: `apps/frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `MeDto`, `ProfileUpdateInput`, `TodayDto`, `FortuneDto`, `FortunePageDto`, `ApiErrorBody` from shared.
- Produces:
  - RTK Query hooks: `useGetMeQuery`, `useUpdateMeMutation`, `useLogoutMutation`, `useOpenTodayMutation`, `useGetFortuneQuery`, `useGetHistoryQuery`; `api`, `makeStore()`.
  - `apiErrorCode(err: unknown): string | null` — reads `error.code` from an RTK error.
  - `Screen` (centered message + optional action) used for loading / error states.
  - Test helpers: `installMockApi(handlers)` and `renderApp(ui?, { route? })`.

- [ ] **Step 1: Package and config files**

`apps/frontend/package.json`:
```json
{
  "name": "@third-eye/frontend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@fontsource/cormorant-garamond": "^5.1.0",
    "@reduxjs/toolkit": "^2.3.0",
    "@third-eye/divination": "workspace:*",
    "@third-eye/shared": "workspace:*",
    "motion": "^11.11.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-redux": "^9.1.2",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.5"
  }
}
```

`apps/frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"], "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "noUncheckedIndexedAccess": true, "skipLibCheck": true,
    "isolatedModules": true, "noEmit": true, "types": ["vite/client", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

`apps/frontend/vite.config.ts` (the PWA plugin is added in Task 22):
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } } },
});
```

`apps/frontend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
});
```

`apps/frontend/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
  plugins: [],
} satisfies Config;
```

`apps/frontend/postcss.config.cjs`:
```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`apps/frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0a0918" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/favicon.svg" />
    <title>Third Eye</title>
  </head>
  <body class="bg-night text-mist">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/frontend/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0a0918"/>
  <path d="M6 32 Q32 8 58 32 Q32 56 6 32 Z" fill="none" stroke="#d4af37" stroke-width="3"/>
  <circle cx="32" cy="32" r="9" fill="#d4af37"/>
  <circle cx="32" cy="32" r="4" fill="#0a0918"/>
</svg>
```

- [ ] **Step 2: Styles**

`apps/frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

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
  .btn { @apply inline-flex min-h-11 items-center justify-center rounded-full px-5 font-medium transition disabled:opacity-40; }
  .btn-gold { @apply btn bg-gold text-night hover:bg-gold-soft active:bg-gold-deep; }
  .btn-ghost { @apply btn border border-gold/40 text-gold-soft hover:bg-gold/10; }
  .card { @apply rounded-2xl border border-gold/20 bg-ink/70 p-5 backdrop-blur; }
  .input { @apply min-h-11 w-full rounded-xl border border-gold/30 bg-night/60 px-3 text-mist placeholder:text-mist/40 focus:border-gold focus:outline-none; }
  .label { @apply mb-1 block text-sm font-medium text-gold-soft/90; }
  .field-error { @apply mt-1 text-sm text-rose-300; }
}
```

- [ ] **Step 3: Store and API slice**

`apps/frontend/src/api.ts`:
```ts
import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type { FortuneDto, FortunePageDto, MeDto, ProfileUpdateInput, TodayDto } from '@third-eye/shared';

// Absolute base so RTK's `new Request(url)` also works under jsdom.
const raw = fetchBaseQuery({ baseUrl: `${globalThis.location?.origin ?? ''}/api`, credentials: 'same-origin' });

/** Unwraps `{ data }` and bounces to login on 401. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  const result = await raw(args, api, extra);
  if (result.error?.status === 401) globalThis.location.assign('/api/auth/login');
  if (result.data && typeof result.data === 'object' && 'data' in result.data) {
    return { ...result, data: (result.data as { data: unknown }).data };
  }
  return result;
};

export function apiErrorCode(err: unknown): string | null {
  const data = (err as { data?: { error?: { code?: unknown } } } | undefined)?.data;
  return typeof data?.error?.code === 'string' ? data.error.code : null;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Me', 'Fortune', 'History'],
  endpoints: (b) => ({
    getMe: b.query<MeDto, void>({ query: () => '/me', providesTags: ['Me'] }),
    updateMe: b.mutation<MeDto, ProfileUpdateInput>({
      query: (body) => ({ url: '/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
    logout: b.mutation<{ endSessionUrl: string | null }, void>({ query: () => ({ url: '/auth/logout', method: 'POST' }) }),
    openToday: b.mutation<TodayDto, void>({
      query: () => ({ url: '/fortunes/today', method: 'POST' }),
      invalidatesTags: (r) => (r ? [{ type: 'Fortune', id: r.fortune.id }, 'History'] : []),
    }),
    getFortune: b.query<FortuneDto, string>({
      query: (id) => `/fortunes/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Fortune', id }],
    }),
    getHistory: b.query<FortunePageDto, string | undefined>({
      query: (cursor) => `/fortunes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      providesTags: ['History'],
    }),
  }),
});

export const {
  useGetMeQuery, useUpdateMeMutation, useLogoutMutation, useOpenTodayMutation, useGetFortuneQuery, useGetHistoryQuery,
} = api;
```

`apps/frontend/src/store.ts`:
```ts
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';

export const makeStore = () =>
  configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: (gdm) => gdm().concat(api.middleware) });
export const store = makeStore();
setupListeners(store.dispatch);
```

- [ ] **Step 4: Shell components, placeholder pages, App, entry**

`apps/frontend/src/components/Screen.tsx`:
```tsx
import type { ReactNode } from 'react';

export function Screen({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-3xl">{title}</h2>
      {children && <div className="max-w-sm text-mist/80">{children}</div>}
      {action}
    </div>
  );
}
```

`apps/frontend/src/components/Layout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router-dom';

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex-1 py-3 text-center text-sm tracking-wide ${isActive ? 'text-gold' : 'text-mist/60'}`;

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <header className="flex items-center justify-center gap-2 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="font-display text-2xl text-gold-soft">Third Eye</span>
      </header>
      <main className="flex-1 px-4 pb-24"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg border-t border-gold/20 bg-night/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <NavLink to="/" end className={tab}>Today</NavLink>
        <NavLink to="/history" className={tab}>History</NavLink>
        <NavLink to="/settings" className={tab}>Settings</NavLink>
      </nav>
    </div>
  );
}
```

Placeholder pages (each replaced in a later task) — create all five with this shape, changing the name and heading:

`apps/frontend/src/pages/Welcome.tsx`:
```tsx
export function Welcome() { return <h1>Welcome</h1>; }
```
`apps/frontend/src/pages/Today.tsx`:
```tsx
export function Today() { return <h1>Today</h1>; }
```
`apps/frontend/src/pages/History.tsx`:
```tsx
export function History() { return <h1>History</h1>; }
```
`apps/frontend/src/pages/FortuneDetail.tsx`:
```tsx
export function FortuneDetail() { return <h1>Fortune</h1>; }
```
`apps/frontend/src/pages/Settings.tsx`:
```tsx
export function Settings() { return <h1>Settings</h1>; }
```

`apps/frontend/src/App.tsx`:
```tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { useGetMeQuery } from './api';
import { Layout } from './components/Layout';
import { Screen } from './components/Screen';
import { FortuneDetail } from './pages/FortuneDetail';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Today } from './pages/Today';
import { Welcome } from './pages/Welcome';

export function App() {
  const { data: me, isLoading, isError, refetch } = useGetMeQuery();
  // A 401 already redirected to login inside baseQuery; anything else is shown.
  if (isError && !me) {
    return <Screen title="The veil is clouded" action={<button className="btn-ghost" onClick={() => void refetch()}>Try again</button>}>We couldn't reach Third Eye.</Screen>;
  }
  if (isLoading || !me) return <Screen title="Opening the veil…" />;
  if (!me.onboarded) return <Welcome />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="history" element={<History />} />
        <Route path="history/:id" element={<FortuneDetail />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

`apps/frontend/src/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/600.css';
import './index.css';
import { App } from './App';
import { store } from './store';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}><BrowserRouter><App /></BrowserRouter></Provider>
  </React.StrictMode>,
);
```

- [ ] **Step 5: Test helpers**

`apps/frontend/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// No test.globals, so testing-library can't auto-register cleanup.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// jsdom has no matchMedia; motion's useReducedMotion reads it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  }) as MediaQueryList;
}
```

`apps/frontend/src/test/mockApi.ts`:
```ts
import { vi } from 'vitest';

export interface MockReply { status?: number; body: unknown }
export type Handler = (req: { body: unknown; url: URL }) => MockReply | Promise<MockReply>;

/**
 * Replaces global fetch. Keys are "METHOD /path" (path without /api prefix and without query).
 * Returns the list of calls so tests can assert on them.
 */
export function installMockApi(handlers: Record<string, Handler | MockReply>) {
  const calls: { method: string; path: string; body: unknown; url: URL }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '');
    const text = await req.text();
    const body = text ? JSON.parse(text) : undefined;
    calls.push({ method: req.method, path, body, url });
    const h = handlers[`${req.method} ${path}`];
    if (!h) return new Response(JSON.stringify({ error: { code: 'not_found', message: `unmocked ${req.method} ${path}` } }), { status: 404, headers: { 'content-type': 'application/json' } });
    const reply = typeof h === 'function' ? await h({ body, url }) : h;
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

export const ok = (data: unknown, status = 200): MockReply => ({ status, body: { data } });
```

`apps/frontend/src/test/render.tsx`:
```tsx
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import type { MeDto } from '@third-eye/shared';
import { App } from '../App';
import { makeStore } from '../store';

export function renderApp(ui: ReactElement = <App />, { route = '/' }: { route?: string } = {}) {
  const store = makeStore();
  return { store, ...render(<Provider store={store}><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></Provider>) };
}

export const me = (over: Partial<MeDto> = {}): MeDto => ({
  user: { sub: 's1', name: 'Ada', email: 'a@x', isAdmin: false },
  profile: { birthDate: '1990-06-15', fullName: null, bloodType: null, timeZone: 'UTC', persona: 'CONFIDANT' },
  onboarded: true,
  ...over,
});
```

- [ ] **Step 6: Write the App test**

`apps/frontend/src/App.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { installMockApi, ok } from './test/mockApi';
import { me, renderApp } from './test/render';

describe('App gate', () => {
  it('sends users who have not onboarded to the welcome screen', async () => {
    installMockApi({ 'GET /me': ok(me({ onboarded: false, profile: { ...me().profile, birthDate: null } })) });
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
  });

  it('shows the app shell with navigation for onboarded users', async () => {
    installMockApi({ 'GET /me': ok(me()) });
    renderApp();
    expect(await screen.findByRole('link', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('offers a retry when /me fails', async () => {
    installMockApi({ 'GET /me': { status: 500, body: { error: { code: 'internal', message: 'x' } } } });
    renderApp();
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Install, run, commit**

Run: `pnpm install; pnpm --filter @third-eye/frontend test`
Expected: PASS (3 tests).

Run: `pnpm typecheck; pnpm lint; pnpm --filter @third-eye/frontend build`
Expected: exit 0.

```bash
git add -A
git commit -m "feat(frontend): scaffold with celestial theme, api slice and onboarding gate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Welcome (onboarding) and Settings

**Files:**
- Create: `apps/frontend/src/components/ProfileForm.tsx`, `apps/frontend/src/components/PersonaPicker.tsx`
- Modify: `apps/frontend/src/pages/Welcome.tsx`, `apps/frontend/src/pages/Settings.tsx`
- Test: `apps/frontend/src/components/ProfileForm.test.tsx`, `apps/frontend/src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `profileUpdateSchema`, `ProfileUpdateInput`, `ProfileDto`, `PERSONA_IDS`, `PERSONAS`, `DEFAULT_PERSONA` (shared); `BLOOD_TYPE_IDS` (divination); `useUpdateMeMutation`, `useGetMeQuery`, `useLogoutMutation`.
- Produces: `ProfileForm({ initial, submitLabel, onSubmit })` where `onSubmit(input: ProfileUpdateInput): Promise<void>`; `PersonaPicker({ value, onChange })`; `detectTimeZone(): string`.

- [ ] **Step 1: Write the failing tests**

`apps/frontend/src/components/ProfileForm.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileForm } from './ProfileForm';

// jsdom date inputs reject partial values, so set the whole date at once.
const setDate = (value: string) => fireEvent.change(screen.getByLabelText('Birth date'), { target: { value } });

describe('ProfileForm', () => {
  it('requires a birth date', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<ProfileForm submitLabel="Begin" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(await screen.findByText(/birth date/i, { selector: '.field-error' })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a full payload with detected time zone and defaults', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<ProfileForm submitLabel="Begin" onSubmit={onSubmit} />);
    setDate('1990-06-15');
    await userEvent.type(screen.getByLabelText(/full birth name/i), 'Ada Lovelace');
    await userEvent.selectOptions(screen.getByLabelText('Blood type'), 'AB');
    await userEvent.click(screen.getByRole('radio', { name: /The Trickster/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(onSubmit).toHaveBeenCalledWith({
      birthDate: '1990-06-15', fullName: 'Ada Lovelace', bloodType: 'AB', timeZone: expect.any(String), persona: 'TRICKSTER',
    });
  });

  it('maps "I don\'t know" blood type and a blank name to null', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<ProfileForm submitLabel="Save" onSubmit={onSubmit}
      initial={{ birthDate: '1990-06-15', fullName: 'Ada', bloodType: 'A', timeZone: 'Europe/London', persona: 'MYSTIC' }} />);
    await userEvent.clear(screen.getByLabelText(/full birth name/i));
    await userEvent.selectOptions(screen.getByLabelText('Blood type'), '');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({
      birthDate: '1990-06-15', fullName: null, bloodType: null, timeZone: 'Europe/London', persona: 'MYSTIC',
    });
  });
});
```

`apps/frontend/src/pages/Settings.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installMockApi, ok } from '../test/mockApi';
import { me, renderApp } from '../test/render';

describe('Settings', () => {
  it('prefills the profile and saves changes', async () => {
    const calls = installMockApi({
      'GET /me': ok(me({ profile: { ...me().profile, bloodType: 'O' } })),
      'PATCH /me': ({ body }) => ok(me({ profile: { ...me().profile, ...(body as object) } })),
    });
    renderApp(undefined, { route: '/settings' });
    expect(await screen.findByLabelText('Birth date')).toHaveValue('1990-06-15');
    expect(screen.getByLabelText('Blood type')).toHaveValue('O');
    await userEvent.click(screen.getByRole('radio', { name: /The Mystic/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toMatchObject({ persona: 'MYSTIC', bloodType: 'O' });
  });
});
```

Run: `pnpm --filter @third-eye/frontend test`
Expected: FAIL — cannot resolve `./ProfileForm`.

- [ ] **Step 2: Persona picker**

`apps/frontend/src/components/PersonaPicker.tsx`:
```tsx
import { PERSONA_IDS, PERSONAS, type PersonaId } from '@third-eye/shared';

export function PersonaPicker({ value, onChange }: { value: PersonaId; onChange: (p: PersonaId) => void }) {
  return (
    <fieldset>
      <legend className="label">Your oracle</legend>
      <div className="grid gap-3">
        {PERSONA_IDS.map((id) => {
          const p = PERSONAS[id];
          const checked = value === id;
          return (
            <label key={id} className={`card cursor-pointer transition ${checked ? 'border-gold ring-1 ring-gold' : 'opacity-80'}`}>
              <input type="radio" name="persona" value={id} checked={checked} onChange={() => onChange(id)} className="sr-only" aria-label={p.name} />
              <span className="block font-display text-xl text-gold-soft">{p.name}</span>
              <span className="block text-sm text-mist/70">{p.tagline}</span>
              <span className="mt-2 block text-sm italic text-mist/90">“{p.sampleLine}”</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 3: Profile form**

`apps/frontend/src/components/ProfileForm.tsx`:
```tsx
import { useMemo, useState, type FormEvent } from 'react';
import { BLOOD_TYPE_IDS } from '@third-eye/divination';
import { DEFAULT_PERSONA, profileUpdateSchema, type PersonaId, type ProfileDto, type ProfileUpdateInput } from '@third-eye/shared';
import { PersonaPicker } from './PersonaPicker';

export const detectTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

type FieldErrors = Partial<Record<keyof ProfileUpdateInput | 'form', string>>;

export function ProfileForm({ initial, submitLabel, onSubmit }: {
  initial?: ProfileDto; submitLabel: string; onSubmit: (input: ProfileUpdateInput) => Promise<void>;
}) {
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [bloodType, setBloodType] = useState<string>(initial?.bloodType ?? '');
  // Onboarding (no birth date yet) pre-selects the browser's zone; afterwards the saved zone is kept.
  const [timeZone, setTimeZone] = useState(initial?.birthDate ? initial.timeZone : detectTimeZone());
  const [persona, setPersona] = useState<PersonaId>(initial?.persona ?? DEFAULT_PERSONA);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    return all.includes(timeZone) ? all : [timeZone, ...all];
  }, [timeZone]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const payload = { birthDate, fullName, bloodType: bloodType || null, timeZone, persona };
    const parsed = profileUpdateSchema.safeParse(payload);
    if (!parsed.success || !birthDate) {
      const fe = parsed.success ? {} : parsed.error.flatten().fieldErrors;
      setErrors({
        ...Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])),
        ...(!birthDate ? { birthDate: 'Your birth date is needed for the reading.' } : {}),
      });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div>
        <label className="label" htmlFor="birthDate">Birth date</label>
        <input id="birthDate" type="date" className="input" value={birthDate} max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthDate(e.target.value)} />
        {errors.birthDate && <p className="field-error">{errors.birthDate}</p>}
      </div>
      <div>
        <label className="label" htmlFor="fullName">Full birth name <span className="text-mist/50">(optional — used for numerology)</span></label>
        <input id="fullName" className="input" value={fullName} autoComplete="name" onChange={(e) => setFullName(e.target.value)} />
        {errors.fullName && <p className="field-error">{errors.fullName}</p>}
      </div>
      <div>
        <label className="label" htmlFor="bloodType">Blood type</label>
        <select id="bloodType" className="input" value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
          <option value="">I don't know</option>
          {BLOOD_TYPE_IDS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <PersonaPicker value={persona} onChange={setPersona} />
      <div>
        <label className="label" htmlFor="timeZone">Time zone</label>
        <select id="timeZone" className="input" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        {errors.timeZone && <p className="field-error">{errors.timeZone}</p>}
      </div>
      {errors.form && <p className="field-error">{errors.form}</p>}
      <button type="submit" className="btn-gold" disabled={busy}>{submitLabel}</button>
    </form>
  );
}
```
Note on the time-zone default: during onboarding the browser's zone is pre-selected so users don't have to find it themselves; once a birth date is saved, the form shows the stored zone.

- [ ] **Step 4: Pages**

Replace `apps/frontend/src/pages/Welcome.tsx`:
```tsx
import { useGetMeQuery, useUpdateMeMutation } from '../api';
import { ProfileForm } from '../components/ProfileForm';

export function Welcome() {
  const { data: me } = useGetMeQuery();
  const [updateMe] = useUpdateMeMutation();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-center text-4xl">Welcome</h1>
      <p className="mt-3 text-center text-mist/80">
        Each day, Third Eye draws tarot, casts a rune and the I Ching, and reads your stars and numbers — then an oracle weaves them into one fortune.
      </p>
      <div className="card mt-8">
        <ProfileForm initial={me?.profile} submitLabel="Begin" onSubmit={async (input) => { await updateMe(input).unwrap(); }} />
      </div>
    </div>
  );
}
```
(When the save succeeds, `updateMe` invalidates `Me`; `App` sees `onboarded: true` and renders Today.)

Replace `apps/frontend/src/pages/Settings.tsx`:
```tsx
import { useState } from 'react';
import { useGetMeQuery, useLogoutMutation, useUpdateMeMutation } from '../api';
import { ProfileForm } from '../components/ProfileForm';

export function Settings() {
  const { data: me } = useGetMeQuery();
  const [updateMe] = useUpdateMeMutation();
  const [logout] = useLogoutMutation();
  const [saved, setSaved] = useState(false);
  if (!me) return null;
  return (
    <div className="grid gap-6 py-4">
      <h1 className="text-3xl">Settings</h1>
      <div className="card">
        <ProfileForm initial={me.profile} submitLabel="Save"
          onSubmit={async (input) => { setSaved(false); await updateMe(input).unwrap(); setSaved(true); }} />
        {saved && <p className="mt-3 text-center text-gold-soft" role="status">Saved</p>}
      </div>
      <p className="text-center text-sm text-mist/60">Changes apply from your next daily fortune. Past fortunes keep the details they were read with.</p>
      <button className="btn-ghost" onClick={async () => {
        const r = await logout().unwrap();
        globalThis.location.assign(r.endSessionUrl ?? '/');
      }}>Sign out</button>
    </div>
  );
}
```

- [ ] **Step 5: Run tests, commit**

Run: `pnpm --filter @third-eye/frontend test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0. (The App test's "Welcome" heading still matches.)

```bash
git add -A
git commit -m "feat(frontend): onboarding and settings with persona picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Symbol components

**Files:**
- Create: `apps/frontend/src/components/symbols/TarotCard.tsx`, `RuneStone.tsx`, `Hexagram.tsx`, `SignRing.tsx`
- Test: `apps/frontend/src/components/symbols/symbols.test.tsx`

**Interfaces:**
- Consumes: `getTarotCard`, `getRune`, `getHexagram`, `hexagramLines`, `getZodiacSign`, `getChineseAnimal`, `getChineseElement`, `getNumberMeaning`, `FortuneResultDto`.
- Produces:
  - `TarotCard({ cardId, reversed, faceDown?, className? })` — SVG, `role="img"`, `aria-label` = card name + " (reversed)" when reversed, or "Face-down card".
  - `RuneStone({ runeId, reversed, className? })` — `aria-label` = "Ansuz" / "Ansuz (reversed)".
  - `Hexagram({ lines?, number?, revealed?, className? })` — pass `lines` (6–9 values, bottom → top) for a cast, or `number` for a plain hexagram. `revealed` (0–6, default 6) shows only the bottom N lines for the ritual. Each line element has `data-line` (`yang`/`yin`) and `data-changing` when 6 or 9.
  - `signItems(results: FortuneResultDto[]): SignItem[]` and `SignRing({ items, revealed? })` where `SignItem = { key: string; glyph: string; label: string }`.

- [ ] **Step 1: Write the failing test**

`apps/frontend/src/components/symbols/symbols.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FortuneResultDto } from '@third-eye/shared';
import { TarotCard } from './TarotCard';
import { RuneStone } from './RuneStone';
import { Hexagram } from './Hexagram';
import { SignRing, signItems } from './SignRing';

describe('symbols', () => {
  it('labels tarot cards by name and orientation', () => {
    render(<><TarotCard cardId="major-16" reversed /><TarotCard cardId="cups-01" reversed={false} /><TarotCard cardId="cups-02" reversed={false} faceDown /></>);
    expect(screen.getByRole('img', { name: 'The Tower (reversed)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ace of Cups' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Face-down card' })).toBeInTheDocument();
  });

  it('labels runes', () => {
    render(<RuneStone runeId="ansuz" reversed />);
    expect(screen.getByRole('img', { name: 'Ansuz (reversed)' })).toBeInTheDocument();
  });

  it('draws six lines and marks the changing ones', () => {
    const { container } = render(<Hexagram lines={[9, 8, 7, 6, 7, 8]} />);
    const lines = container.querySelectorAll('[data-line]');
    expect(lines).toHaveLength(6);
    expect(container.querySelectorAll('[data-changing]')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Hexagram 63: After Completion' })).toBeInTheDocument();
  });

  it('reveals only the bottom lines during the ritual', () => {
    const { container } = render(<Hexagram lines={[7, 7, 7, 8, 8, 8]} revealed={2} />);
    expect(container.querySelectorAll('[data-line]:not([data-hidden])')).toHaveLength(2);
  });

  it('builds sign items from birth results', () => {
    const results: FortuneResultDto[] = [
      { method: 'WESTERN', data: { sign: 'gemini' }, reading: null },
      { method: 'CHINESE', data: { animal: 'horse', element: 'metal', polarity: 'yang', lunarYear: 1990 }, reading: null },
      { method: 'NUMEROLOGY', data: { lifePath: 4, expression: null }, reading: null },
      { method: 'BLOODTYPE', data: { type: 'O' }, reading: null },
    ];
    const items = signItems(results);
    expect(items.map((i) => i.label)).toEqual(['Gemini', 'Metal Horse', 'Life Path 4', 'Blood type O']);
    render(<SignRing items={items} />);
    expect(screen.getByText('Metal Horse')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @third-eye/frontend test`
Expected: FAIL — cannot resolve `./TarotCard`.

- [ ] **Step 2: Tarot card**

`apps/frontend/src/components/symbols/TarotCard.tsx`:
```tsx
import { getTarotCard, type TarotCard as Card } from '@third-eye/divination';

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const MINOR_RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'P', 'Kn', 'Q', 'K'];
const GOLD = '#d4af37';

function Emblem({ card }: { card: Card }) {
  switch (card.suit) {
    case 'wands':
      return <g stroke={GOLD} strokeWidth="3" strokeLinecap="round"><line x1="60" y1="70" x2="60" y2="130" /><circle cx="52" cy="85" r="3" fill={GOLD} /><circle cx="68" cy="100" r="3" fill={GOLD} /></g>;
    case 'cups':
      return <g fill="none" stroke={GOLD} strokeWidth="3"><path d="M40 78 Q60 128 80 78 Z" /><line x1="60" y1="104" x2="60" y2="124" /><line x1="48" y1="126" x2="72" y2="126" /></g>;
    case 'swords':
      return <g stroke={GOLD} strokeWidth="3" strokeLinecap="round"><line x1="60" y1="66" x2="60" y2="132" /><line x1="46" y1="112" x2="74" y2="112" /></g>;
    case 'pentacles':
      return <g fill="none" stroke={GOLD} strokeWidth="2.5"><circle cx="60" cy="100" r="24" /><polygon points="60,79 72,115 41,93 79,93 48,115" /></g>;
    default:
      return (
        <g fill="none" stroke={GOLD} strokeWidth="2.5">
          <path d="M32 100 Q60 72 88 100 Q60 128 32 100 Z" />
          <circle cx="60" cy="100" r="9" fill={GOLD} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="60" y1="62" x2="60" y2="70" transform={`rotate(${a} 60 100)`} />
          ))}
        </g>
      );
  }
}

export function TarotCard({ cardId, reversed, faceDown = false, className = '' }: {
  cardId: string; reversed: boolean; faceDown?: boolean; className?: string;
}) {
  if (faceDown) {
    return (
      <svg viewBox="0 0 120 200" role="img" aria-label="Face-down card" className={className}>
        <rect x="2" y="2" width="116" height="196" rx="10" fill="#1e1b4b" stroke={GOLD} strokeWidth="2" />
        <rect x="10" y="10" width="100" height="180" rx="6" fill="none" stroke={GOLD} strokeOpacity="0.4" />
        <path d="M34 100 Q60 78 86 100 Q60 122 34 100 Z" fill="none" stroke={GOLD} strokeWidth="2" />
        <circle cx="60" cy="100" r="7" fill={GOLD} />
      </svg>
    );
  }
  const card = getTarotCard(cardId);
  const corner = card.arcana === 'major' ? ROMAN[card.rank]! : MINOR_RANK[card.rank]!;
  return (
    <svg viewBox="0 0 120 200" role="img" aria-label={`${card.name}${reversed ? ' (reversed)' : ''}`} className={className}>
      <g transform={reversed ? 'rotate(180 60 100)' : undefined}>
        <rect x="2" y="2" width="116" height="196" rx="10" fill="#13112a" stroke={GOLD} strokeWidth="2" />
        <text x="60" y="30" textAnchor="middle" fill={GOLD} fontSize="16" fontFamily="Cormorant Garamond, serif">{corner}</text>
        <Emblem card={card} />
        <text x="60" y="178" textAnchor="middle" fill="#e9d8a6" fontSize="10" fontFamily="Cormorant Garamond, serif">{card.name}</text>
      </g>
    </svg>
  );
}
```

- [ ] **Step 3: Rune stone**

`apps/frontend/src/components/symbols/RuneStone.tsx`:
```tsx
import { getRune } from '@third-eye/divination';

export function RuneStone({ runeId, reversed, className = '' }: { runeId: string; reversed: boolean; className?: string }) {
  const rune = getRune(runeId);
  return (
    <svg viewBox="0 0 100 120" role="img" aria-label={`${rune.name}${reversed ? ' (reversed)' : ''}`} className={className}>
      <defs>
        <radialGradient id={`stone-${runeId}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#4b4870" /><stop offset="100%" stopColor="#1b1935" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="60" rx="42" ry="54" fill={`url(#stone-${runeId})`} stroke="#d4af37" strokeOpacity="0.5" />
      <text x="50" y="78" textAnchor="middle" fontSize="52" fill="#d4af37" transform={reversed ? 'rotate(180 50 60)' : undefined}>{rune.glyph}</text>
    </svg>
  );
}
```

- [ ] **Step 4: Hexagram**

`apps/frontend/src/components/symbols/Hexagram.tsx`:
```tsx
import { getHexagram, hexagramLines, hexagramNumber } from '@third-eye/divination';

type LineValue = 6 | 7 | 8 | 9;

export function Hexagram({ lines, number, revealed = 6, className = '' }: {
  lines?: LineValue[]; number?: number; revealed?: number; className?: string;
}) {
  const bits = lines ? lines.map((l) => (l === 7 || l === 9 ? 1 : 0)) : hexagramLines(number!);
  const n = lines ? hexagramNumber(bits as (0 | 1)[]) : number!;
  const hex = getHexagram(n);
  // Row 0 is the TOP line (index 5); lines are cast bottom-up.
  const rows = [5, 4, 3, 2, 1, 0];
  return (
    <svg viewBox="0 0 100 110" role="img" aria-label={`Hexagram ${n}: ${hex.name}`} className={className}>
      {rows.map((i, row) => {
        const y = 8 + row * 17;
        const value = lines?.[i];
        const changing = value === 6 || value === 9;
        const hidden = i >= revealed;
        const color = changing ? '#f5d76e' : '#d4af37';
        const common = {
          'data-line': bits[i] ? 'yang' : 'yin',
          ...(changing ? { 'data-changing': '' } : {}),
          ...(hidden ? { 'data-hidden': '' } : {}),
          opacity: hidden ? 0 : 1,
          style: { transition: 'opacity 400ms' },
        };
        return bits[i]
          ? <rect key={i} {...common} x="10" y={y} width="80" height="9" rx="2" fill={color} filter={changing ? 'drop-shadow(0 0 3px #f5d76e)' : undefined} />
          : (
            <g key={i} {...common} fill={color}>
              <rect x="10" y={y} width="34" height="9" rx="2" />
              <rect x="56" y={y} width="34" height="9" rx="2" />
            </g>
          );
      })}
    </svg>
  );
}
```

- [ ] **Step 5: Sign ring**

`apps/frontend/src/components/symbols/SignRing.tsx`:
```tsx
import { getChineseAnimal, getChineseElement, getZodiacSign } from '@third-eye/divination';
import type { FortuneResultDto } from '@third-eye/shared';

export interface SignItem { key: string; glyph: string; label: string }

export function signItems(results: FortuneResultDto[]): SignItem[] {
  const items: SignItem[] = [];
  for (const r of results) {
    if (r.method === 'WESTERN') {
      const s = getZodiacSign((r.data as { sign: Parameters<typeof getZodiacSign>[0] }).sign);
      items.push({ key: r.method, glyph: s.glyph, label: s.name });
    } else if (r.method === 'CHINESE') {
      const d = r.data as { animal: Parameters<typeof getChineseAnimal>[0]; element: Parameters<typeof getChineseElement>[0] };
      const a = getChineseAnimal(d.animal);
      items.push({ key: r.method, glyph: a.glyph, label: `${getChineseElement(d.element).name} ${a.name}` });
    } else if (r.method === 'NUMEROLOGY') {
      const n = (r.data as { lifePath: number }).lifePath;
      items.push({ key: r.method, glyph: String(n), label: `Life Path ${n}` });
    } else if (r.method === 'BLOODTYPE') {
      const t = (r.data as { type: string }).type;
      items.push({ key: r.method, glyph: t, label: `Blood type ${t}` });
    }
  }
  return items;
}

export function SignRing({ items, revealed }: { items: SignItem[]; revealed?: number }) {
  const shown = revealed ?? items.length;
  return (
    <ul className="flex flex-wrap justify-center gap-4">
      {items.map((it, i) => (
        <li key={it.key} className={`flex w-24 flex-col items-center gap-1 transition-opacity duration-500 ${i < shown ? 'opacity-100' : 'opacity-0'}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 font-display text-3xl text-gold shadow-[0_0_18px_rgba(212,175,55,0.25)]">{it.glyph}</span>
          <span className="text-center text-sm text-mist/80">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Run tests, commit**

Run: `pnpm --filter @third-eye/frontend test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0.

```bash
git add -A
git commit -m "feat(frontend): svg tarot cards, rune stones, hexagrams and sign ring

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Ritual sequencer and the Today page

**Files:**
- Create: `apps/frontend/src/ritual/useRitual.ts`, `apps/frontend/src/ritual/steps.tsx`, `apps/frontend/src/ritual/Ritual.tsx`
- Create (minimal here, completed in Task 21): `apps/frontend/src/components/FortuneView.tsx`
- Modify: `apps/frontend/src/pages/Today.tsx`
- Test: `apps/frontend/src/ritual/useRitual.test.ts`, `apps/frontend/src/pages/Today.test.tsx`

**Interfaces:**
- Consumes: `useOpenTodayMutation`, `useGetFortuneQuery`, `api`, `apiErrorCode`, symbol components, `signItems`.
- Produces:
  - `useRitual(durations: number[], ready: boolean): { index: number; done: boolean; skip(): void }`. Steps `0 … n-2` advance on their timers; the last step ("the oracle speaks") holds until `ready`, then waits its own duration and sets `done`. `skip()` jumps to the next step immediately, but never past the last step before `ready`.
  - `buildRitualSteps(fortune: FortuneDto, reduced: boolean): RitualStep[]` where `RitualStep = { key: string; caption: string; duration: number; render: () => ReactNode }`.
  - `Ritual({ fortune, ready, onDone })`.
  - `FortuneView({ fortune })` — Task 20 ships a minimal version (summary + method list); Task 21 completes it.

**Today page behaviour:**
1. On mount, call `openToday()` exactly once (guard with a ref — React StrictMode mounts twice in dev).
2. `409 needs_onboarding` → invalidate `Me` so the App gate shows Welcome.
3. `fresh: true` → play the ritual. Meanwhile poll `GET /fortunes/:id` every 2 s while the status is `PENDING`.
4. Ritual finished (or not fresh) → `READY`: show `FortuneView` and a "Replay the ritual" button. `PENDING`: show the draws with "The oracle is still speaking…". `FAILED`: "The spirits are quiet…" with "Try again", which calls `openToday()` again (the server keeps the draws and retries the reading).

- [ ] **Step 1: Write the failing hook test**

`apps/frontend/src/ritual/useRitual.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRitual } from './useRitual';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const durations = [1000, 1000, 500];

describe('useRitual', () => {
  it('advances on timers and holds on the last step until ready', () => {
    const { result, rerender } = renderHook(({ ready }) => useRitual(durations, ready), { initialProps: { ready: false } });
    expect(result.current.index).toBe(0);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.index).toBe(1);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.index).toBe(2);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.done).toBe(false);
    rerender({ ready: true });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.done).toBe(true);
  });

  it('skip jumps ahead but cannot pass the oracle before ready', () => {
    const { result, rerender } = renderHook(({ ready }) => useRitual(durations, ready), { initialProps: { ready: false } });
    act(() => { result.current.skip(); });
    act(() => { result.current.skip(); });
    expect(result.current.index).toBe(2);
    act(() => { result.current.skip(); });
    expect(result.current.done).toBe(false);
    rerender({ ready: true });
    act(() => { result.current.skip(); });
    expect(result.current.done).toBe(true);
  });

  it('finishes quickly when the reading is already ready', () => {
    const { result } = renderHook(() => useRitual(durations, true));
    act(() => { vi.advanceTimersByTime(2500); });
    expect(result.current.done).toBe(true);
  });
});
```

Run: `pnpm --filter @third-eye/frontend test`
Expected: FAIL — cannot resolve `./useRitual`.

- [ ] **Step 2: Implement `useRitual`**

`apps/frontend/src/ritual/useRitual.ts`:
```ts
import { useCallback, useEffect, useState } from 'react';

/**
 * Step machine for the ritual. The last step is "the oracle speaks": it holds until `ready`,
 * then lingers for its own duration before `done`.
 */
export function useRitual(durations: number[], ready: boolean) {
  const last = durations.length - 1;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < last) {
      const t = setTimeout(() => setIndex((i) => i + 1), durations[index]);
      return () => clearTimeout(t);
    }
    if (index === last && ready) {
      const t = setTimeout(() => setIndex(last + 1), durations[last]);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [index, ready, durations, last]);

  const skip = useCallback(() => {
    setIndex((i) => (i < last ? i + 1 : i === last && ready ? last + 1 : i));
  }, [last, ready]);

  return { index: Math.min(index, last), done: index > last, skip };
}
```

- [ ] **Step 3: Ritual steps and component**

`apps/frontend/src/ritual/steps.tsx`:
```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { IChingData, RuneData, TarotData } from '@third-eye/divination';
import type { FortuneDto } from '@third-eye/shared';
import { TarotCard } from '../components/symbols/TarotCard';
import { RuneStone } from '../components/symbols/RuneStone';
import { Hexagram } from '../components/symbols/Hexagram';
import { SignRing, signItems } from '../components/symbols/SignRing';

export interface RitualStep { key: string; caption: string; duration: number; render: () => ReactNode }

/** Counts up 0 → max, one tick per `every` ms. Used to reveal cards / lines / signs one at a time. */
function useTicker(max: number, every: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= max) return undefined;
    const t = setTimeout(() => setN((x) => x + 1), every);
    return () => clearTimeout(t);
  }, [n, max, every]);
  return n;
}

function TarotStep({ data, reduced }: { data: TarotData; reduced: boolean }) {
  const flipped = useTicker(data.cards.length, reduced ? 150 : 800);
  return (
    <div className="flex justify-center gap-3">
      {data.cards.map((c, i) => (
        <div key={c.id} className="flex w-24 flex-col items-center gap-2">
          <motion.div
            initial={reduced ? { opacity: 0 } : { rotateY: 180, y: -30, opacity: 0 }}
            animate={i < flipped ? { rotateY: 0, y: 0, opacity: 1 } : { rotateY: 180, y: 0, opacity: 1 }}
            transition={{ duration: reduced ? 0.2 : 0.7 }}
          >
            <TarotCard cardId={c.id} reversed={c.reversed} faceDown={i >= flipped} className="w-24" />
          </motion.div>
          <span className="text-xs uppercase tracking-widest text-mist/60">{c.position}</span>
        </div>
      ))}
    </div>
  );
}

function RuneStep({ data, reduced }: { data: RuneData; reduced: boolean }) {
  return (
    <motion.div className="flex justify-center"
      initial={reduced ? { opacity: 0 } : { y: -80, rotate: -25, opacity: 0 }}
      animate={{ y: 0, rotate: 0, opacity: 1 }}
      transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 120, damping: 12 }}>
      <RuneStone runeId={data.id} reversed={data.reversed} className="w-28" />
    </motion.div>
  );
}

function IChingStep({ data, reduced }: { data: IChingData; reduced: boolean }) {
  const cast = useTicker(6, reduced ? 80 : 420);
  return (
    <div className="flex items-center justify-center gap-6">
      <Hexagram lines={data.lines} revealed={cast} className="w-28" />
      {data.relating !== null && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: cast >= 6 ? 1 : 0 }} transition={{ duration: 0.6 }} className="flex items-center gap-6">
          <span className="text-2xl text-gold/70">→</span>
          <Hexagram number={data.relating} className="w-20 opacity-80" />
        </motion.div>
      )}
    </div>
  );
}

function SignsStep({ fortune, reduced }: { fortune: FortuneDto; reduced: boolean }) {
  const items = signItems(fortune.results);
  const shown = useTicker(items.length, reduced ? 80 : 450);
  return <SignRing items={items} revealed={shown} />;
}

function OracleStep({ reduced }: { reduced: boolean }) {
  return (
    <motion.p className="text-center font-display text-3xl text-gold-soft"
      animate={reduced ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
      transition={reduced ? undefined : { duration: 2.4, repeat: Infinity }}>
      The oracle speaks…
    </motion.p>
  );
}

export function buildRitualSteps(fortune: FortuneDto, reduced: boolean): RitualStep[] {
  const d = (normal: number) => (reduced ? 800 : normal);
  const byMethod = Object.fromEntries(fortune.results.map((r) => [r.method, r.data]));
  const steps: RitualStep[] = [];
  if (byMethod.TAROT) steps.push({ key: 'tarot', caption: 'The cards are drawn', duration: d(3400), render: () => <TarotStep data={byMethod.TAROT as TarotData} reduced={reduced} /> });
  if (byMethod.RUNE) steps.push({ key: 'rune', caption: 'A rune is cast', duration: d(2200), render: () => <RuneStep data={byMethod.RUNE as RuneData} reduced={reduced} /> });
  if (byMethod.ICHING) steps.push({ key: 'iching', caption: 'The coins fall six times', duration: d(3600), render: () => <IChingStep data={byMethod.ICHING as IChingData} reduced={reduced} /> });
  if (signItems(fortune.results).length) steps.push({ key: 'signs', caption: 'Your stars and numbers', duration: d(2800), render: () => <SignsStep fortune={fortune} reduced={reduced} /> });
  steps.push({ key: 'oracle', caption: '', duration: reduced ? 300 : 1200, render: () => <OracleStep reduced={reduced} /> });
  return steps;
}
```

`apps/frontend/src/ritual/Ritual.tsx`:
```tsx
import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { FortuneDto } from '@third-eye/shared';
import { buildRitualSteps } from './steps';
import { useRitual } from './useRitual';

export function Ritual({ fortune, ready, onDone }: { fortune: FortuneDto; ready: boolean; onDone: () => void }) {
  const reduced = useReducedMotion() ?? false;
  // Built once per fortune: the draws don't change while the reading is written.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const steps = useMemo(() => buildRitualSteps(fortune, reduced), [fortune.id, reduced]);
  const durations = useMemo(() => steps.map((s) => s.duration), [steps]);
  const { index, done, skip } = useRitual(durations, ready);

  useEffect(() => { if (done) onDone(); }, [done, onDone]);
  const step = steps[index]!;

  return (
    <button type="button" onClick={skip} aria-label="Continue the ritual"
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-8 text-left">
      <AnimatePresence mode="wait">
        <motion.div key={step.key} className="w-full"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.15 : 0.4 }}>
          {step.render()}
        </motion.div>
      </AnimatePresence>
      {step.caption && <p className="font-display text-xl text-gold-soft/90">{step.caption}</p>}
      <p className="text-xs text-mist/40">Tap to continue</p>
    </button>
  );
}
```

- [ ] **Step 4: Minimal `FortuneView`**

`apps/frontend/src/components/FortuneView.tsx`:
```tsx
import { METHOD_LABELS } from '@third-eye/divination';
import type { FortuneDto } from '@third-eye/shared';

/** Minimal version; Task 21 replaces this with the full layout. */
export function FortuneView({ fortune }: { fortune: FortuneDto }) {
  return (
    <article className="grid gap-4">
      {fortune.summary && <p className="card whitespace-pre-line text-lg leading-relaxed">{fortune.summary}</p>}
      {fortune.results.map((r) => (
        <section key={r.method} className="card">
          <h3 className="text-xl">{METHOD_LABELS[r.method]}</h3>
          {r.reading && <p>{r.reading}</p>}
        </section>
      ))}
    </article>
  );
}
```

- [ ] **Step 5: Write the failing Today test**

`apps/frontend/src/pages/Today.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FortuneDto } from '@third-eye/shared';
import { installMockApi, ok } from '../test/mockApi';
import { me, renderApp } from '../test/render';

const fortune = (over: Partial<FortuneDto> = {}): FortuneDto => ({
  id: '11111111-1111-4111-8111-111111111111', date: '2026-09-26', status: 'READY', persona: 'CONFIDANT',
  summary: 'A gentle day with a sharp turn in the afternoon.',
  results: [
    { method: 'TAROT', data: { cards: [
      { id: 'major-16', reversed: true, position: 'situation' },
      { id: 'cups-01', reversed: false, position: 'challenge' },
      { id: 'swords-12', reversed: false, position: 'advice' },
    ] }, reading: 'The Tower asks you to let go.' },
    { method: 'WESTERN', data: { sign: 'gemini' }, reading: 'Gemini curiosity serves you.' },
  ],
  ...over,
});

describe('Today', () => {
  it('shows a returning visitor the finished fortune with a replay button', async () => {
    installMockApi({
      'GET /me': ok(me()),
      'POST /fortunes/today': ok({ fortune: fortune(), fresh: false }),
      [`GET /fortunes/${fortune().id}`]: ok(fortune()),
    });
    renderApp();
    expect(await screen.findByText('A gentle day with a sharp turn in the afternoon.')).toBeInTheDocument();
    expect(screen.getByText('The Tower asks you to let go.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay the ritual' })).toBeInTheDocument();
  });

  it('plays the ritual for a fresh fortune', async () => {
    const pending = fortune({ status: 'PENDING', summary: null, results: fortune().results.map((r) => ({ ...r, reading: null })) });
    installMockApi({
      'GET /me': ok(me()),
      'POST /fortunes/today': ok({ fortune: pending, fresh: true }, 201),
      [`GET /fortunes/${pending.id}`]: ok(pending),
    });
    renderApp();
    expect(await screen.findByRole('button', { name: 'Continue the ritual' })).toBeInTheDocument();
    expect(screen.getByText('The cards are drawn')).toBeInTheDocument();
  });

  it('offers a retry when the reading failed, and asks the server again', async () => {
    const failed = fortune({ status: 'FAILED', summary: null });
    const calls = installMockApi({
      'GET /me': ok(me()),
      'POST /fortunes/today': ok({ fortune: failed, fresh: false }),
      [`GET /fortunes/${failed.id}`]: ok(failed),
    });
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/fortunes/today')).toHaveLength(2);
  });
});
```

Run: `pnpm --filter @third-eye/frontend test`
Expected: FAIL — Today still renders the placeholder.

- [ ] **Step 6: Implement the Today page**

Replace `apps/frontend/src/pages/Today.tsx`:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query';
import type { TodayDto } from '@third-eye/shared';
import { api, apiErrorCode, useGetFortuneQuery, useOpenTodayMutation } from '../api';
import { FortuneView } from '../components/FortuneView';
import { Screen } from '../components/Screen';
import { Ritual } from '../ritual/Ritual';

export function Today() {
  const dispatch = useDispatch();
  const [openToday] = useOpenTodayMutation();
  const [today, setToday] = useState<TodayDto | null>(null);
  const [failedToOpen, setFailedToOpen] = useState(false);
  const [ritual, setRitual] = useState(false);
  const started = useRef(false);

  const open = useCallback(async () => {
    setFailedToOpen(false);
    try {
      const t = await openToday().unwrap();
      setToday(t);
      if (t.fresh) setRitual(true);
    } catch (err) {
      if (apiErrorCode(err) === 'needs_onboarding') dispatch(api.util.invalidateTags(['Me']));
      else setFailedToOpen(true);
    }
  }, [openToday, dispatch]);

  useEffect(() => {
    if (started.current) return;   // StrictMode mounts effects twice in dev
    started.current = true;
    void open();
  }, [open]);

  const [pollMs, setPollMs] = useState(2000);
  const { data: live } = useGetFortuneQuery(today ? today.fortune.id : skipToken, { pollingInterval: pollMs });
  const fortune = live ?? today?.fortune;
  useEffect(() => { setPollMs(fortune?.status === 'PENDING' ? 2000 : 0); }, [fortune?.status]);
  const endRitual = useCallback(() => setRitual(false), []);

  if (failedToOpen) {
    return <Screen title="The veil is clouded" action={<button className="btn-ghost" onClick={() => void open()}>Try again</button>}>We couldn't open today's fortune.</Screen>;
  }
  if (!fortune) return <Screen title="Opening the veil…" />;
  if (ritual) return <Ritual fortune={fortune} ready={fortune.status !== 'PENDING'} onDone={endRitual} />;

  return (
    <div className="grid gap-6 py-4">
      <header className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-mist/50">
          {new Date(`${fortune.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
        </p>
        <h1 className="mt-1 text-4xl">Your fortune</h1>
      </header>
      {fortune.status === 'FAILED' && (
        <Screen title="The spirits are quiet…" action={<button className="btn-gold" onClick={() => void open()}>Try again</button>}>
          Your cards are drawn, but the oracle could not speak just now.
        </Screen>
      )}
      {fortune.status === 'PENDING' && <p className="text-center font-display text-2xl text-gold-soft">The oracle is still speaking…</p>}
      <FortuneView fortune={fortune} />
      {fortune.status === 'READY' && (
        <button className="btn-ghost mx-auto" onClick={() => setRitual(true)}>Replay the ritual</button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run tests, commit**

Run: `pnpm --filter @third-eye/frontend test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0.

```bash
git add -A
git commit -m "feat(frontend): ritual animation over the real draws and the today page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Fortune view, History and detail

**Files:**
- Create: `apps/frontend/src/components/MethodCard.tsx`
- Modify: `apps/frontend/src/components/FortuneView.tsx`, `apps/frontend/src/pages/History.tsx`, `apps/frontend/src/pages/FortuneDetail.tsx`
- Test: `apps/frontend/src/components/FortuneView.test.tsx`, `apps/frontend/src/pages/History.test.tsx`

**Interfaces:**
- Consumes: `describeResult`, `METHOD_LABELS`, `PERSONAS`, symbols, `useGetHistoryQuery`, `useGetFortuneQuery`.
- Produces: `FortuneView({ fortune })` (full), `MethodCard({ result })`, `MiniSymbols({ results })` (exported from `MethodCard.tsx`, used by History rows).

- [ ] **Step 1: Write the failing tests**

`apps/frontend/src/components/FortuneView.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FortuneDto } from '@third-eye/shared';
import { FortuneView } from './FortuneView';

const base: FortuneDto = {
  id: 'f1', date: '2026-09-26', status: 'READY', persona: 'MYSTIC', summary: 'The veil parts.',
  results: [
    { method: 'RUNE', data: { id: 'ansuz', reversed: false }, reading: 'Listen closely today.' },
    { method: 'NUMEROLOGY', data: { lifePath: 4, expression: null }, reading: 'Build steadily.' },
  ],
};

describe('FortuneView', () => {
  it('shows the persona, summary, each method with its facts and reading', () => {
    render(<FortuneView fortune={base} />);
    expect(screen.getByText('The Mystic')).toBeInTheDocument();
    expect(screen.getByText('The veil parts.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rune' })).toBeInTheDocument();
    expect(screen.getByText(/Ansuz ᚨ \(upright\)/)).toBeInTheDocument();
    expect(screen.getByText('Listen closely today.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Numerology' })).toBeInTheDocument();
  });

  it('shows placeholders while readings are pending', () => {
    render(<FortuneView fortune={{ ...base, status: 'PENDING', summary: null, results: base.results.map((r) => ({ ...r, reading: null })) }} />);
    expect(screen.getAllByTestId('reading-pending')).toHaveLength(2);
  });
});
```

`apps/frontend/src/pages/History.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FortuneSummaryDto } from '@third-eye/shared';
import { installMockApi, ok } from '../test/mockApi';
import { me, renderApp } from '../test/render';

const item = (date: string): FortuneSummaryDto => ({
  id: `id-${date}`, date, status: 'READY', persona: 'CONFIDANT', excerpt: `Excerpt for ${date}.`,
  results: [{ method: 'RUNE', data: { id: 'fehu', reversed: false }, reading: null }],
});

describe('History', () => {
  it('lists past fortunes and loads more pages', async () => {
    installMockApi({
      'GET /me': ok(me()),
      'GET /fortunes': ({ url }) => url.searchParams.get('cursor') === '2026-09-25'
        ? ok({ items: [item('2026-09-24')], nextCursor: null })
        : ok({ items: [item('2026-09-26'), item('2026-09-25')], nextCursor: '2026-09-25' }),
    });
    renderApp(undefined, { route: '/history' });
    expect(await screen.findByText('Excerpt for 2026-09-26.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show older' }));
    expect(await screen.findByText('Excerpt for 2026-09-24.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Excerpt for 2026-09-25/ })).toHaveAttribute('href', '/history/id-2026-09-25');
  });

  it('has a friendly empty state', async () => {
    installMockApi({ 'GET /me': ok(me()), 'GET /fortunes': ok({ items: [], nextCursor: null }) });
    renderApp(undefined, { route: '/history' });
    expect(await screen.findByText(/no fortunes yet/i)).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @third-eye/frontend test`
Expected: FAIL.

- [ ] **Step 2: Method card and mini symbols**

`apps/frontend/src/components/MethodCard.tsx`:
```tsx
import { describeResult, getRune, getZodiacSign, type IChingData, type MethodResult, type RuneData, type TarotData, type WesternData } from '@third-eye/divination';
import type { FortuneResultDto } from '@third-eye/shared';
import { TarotCard } from './symbols/TarotCard';
import { RuneStone } from './symbols/RuneStone';
import { Hexagram } from './symbols/Hexagram';
import { SignRing, signItems } from './symbols/SignRing';

function MethodSymbol({ result }: { result: FortuneResultDto }) {
  switch (result.method) {
    case 'TAROT':
      return <div className="flex gap-2">{(result.data as TarotData).cards.map((c) => <TarotCard key={c.id} cardId={c.id} reversed={c.reversed} className="w-16" />)}</div>;
    case 'RUNE': {
      const d = result.data as RuneData;
      return <RuneStone runeId={d.id} reversed={d.reversed} className="w-14" />;
    }
    case 'ICHING': {
      const d = result.data as IChingData;
      return <div className="flex items-center gap-3"><Hexagram lines={d.lines} className="w-16" />{d.relating !== null && <><span className="text-gold/60">→</span><Hexagram number={d.relating} className="w-12" /></>}</div>;
    }
    default:
      return <SignRing items={signItems([result])} />;
  }
}

export function MethodCard({ result }: { result: FortuneResultDto }) {
  const desc = describeResult({ method: result.method, data: result.data } as MethodResult);
  return (
    <section className="card grid gap-3">
      <h3 className="text-2xl">{desc.title}</h3>
      <div className="flex justify-center"><MethodSymbol result={result} /></div>
      <ul className="grid gap-1 text-sm text-mist/60">{desc.facts.map((f) => <li key={f}>{f}</li>)}</ul>
      {result.reading
        ? <p className="leading-relaxed">{result.reading}</p>
        : <p data-testid="reading-pending" className="h-12 animate-pulse rounded-lg bg-gold/10" aria-label="Reading in progress" />}
    </section>
  );
}

/** Compact glyph row for history rows. */
export function MiniSymbols({ results }: { results: FortuneResultDto[] }) {
  const glyphs: string[] = [];
  for (const r of results) {
    if (r.method === 'RUNE') glyphs.push(getRune((r.data as RuneData).id).glyph);
    if (r.method === 'ICHING') glyphs.push(String.fromCodePoint(0x4dc0 + (r.data as IChingData).primary - 1));
    if (r.method === 'WESTERN') glyphs.push(getZodiacSign((r.data as WesternData).sign).glyph);
  }
  return <span aria-hidden className="font-display text-xl tracking-widest text-gold/80">{glyphs.join(' ')}</span>;
}
```
(`U+4DC0`–`U+4DFF` are the Unicode hexagram symbols in King Wen order, so `0x4dc0 + n − 1` is hexagram *n*.)

- [ ] **Step 3: Full `FortuneView`**

Replace `apps/frontend/src/components/FortuneView.tsx`:
```tsx
import { PERSONAS, type FortuneDto } from '@third-eye/shared';
import { MethodCard } from './MethodCard';

export function FortuneView({ fortune }: { fortune: FortuneDto }) {
  return (
    <article className="grid gap-5">
      <section className="card text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-mist/50">as told by</p>
        <p className="font-display text-2xl text-gold">{PERSONAS[fortune.persona].name}</p>
        {fortune.summary
          ? <p className="mt-4 whitespace-pre-line text-left text-lg leading-relaxed">{fortune.summary}</p>
          : <p data-testid="summary-pending" className="mt-4 h-28 animate-pulse rounded-lg bg-gold/10" aria-label="Summary in progress" />}
      </section>
      {fortune.results.map((r) => <MethodCard key={r.method} result={r} />)}
    </article>
  );
}
```

- [ ] **Step 4: History and detail pages**

Replace `apps/frontend/src/pages/History.tsx`:
```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetHistoryQuery } from '../api';
import { MiniSymbols } from '../components/MethodCard';
import { Screen } from '../components/Screen';

const fmt = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function Page({ cursor, isLast, onMore }: { cursor: string | undefined; isLast: boolean; onMore: (c: string) => void }) {
  const { data, isLoading, isError, refetch } = useGetHistoryQuery(cursor);
  if (isLoading) return <p className="py-6 text-center text-mist/50">Consulting the archive…</p>;
  if (isError || !data) return <button className="btn-ghost mx-auto" onClick={() => void refetch()}>Try again</button>;
  if (!cursor && data.items.length === 0) return <Screen title="No fortunes yet">Your first reading will appear here tomorrow.</Screen>;
  return (
    <>
      {data.items.map((f) => (
        <Link key={f.id} to={`/history/${f.id}`} className="card block transition hover:border-gold/50">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm uppercase tracking-widest text-mist/60">{fmt(f.date)}</span>
            <MiniSymbols results={f.results} />
          </div>
          <p className="mt-2">{f.excerpt ?? (f.status === 'FAILED' ? 'The oracle was silent this day.' : 'The oracle is still speaking…')}</p>
        </Link>
      ))}
      {isLast && data.nextCursor && <button className="btn-ghost mx-auto" onClick={() => onMore(data.nextCursor!)}>Show older</button>}
    </>
  );
}

export function History() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  return (
    <div className="grid gap-4 py-4">
      <h1 className="text-center text-4xl">Past fortunes</h1>
      {cursors.map((c, i) => (
        <Page key={c ?? 'first'} cursor={c} isLast={i === cursors.length - 1} onMore={(next) => setCursors((cs) => [...cs, next])} />
      ))}
    </div>
  );
}
```

Replace `apps/frontend/src/pages/FortuneDetail.tsx`:
```tsx
import { Link, useParams } from 'react-router-dom';
import { useGetFortuneQuery } from '../api';
import { FortuneView } from '../components/FortuneView';
import { Screen } from '../components/Screen';

export function FortuneDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useGetFortuneQuery(id!);
  if (isLoading) return <Screen title="Opening the archive…" />;
  if (isError || !data) return <Screen title="Not found" action={<Link className="btn-ghost" to="/history">Back to history</Link>} />;
  return (
    <div className="grid gap-6 py-4">
      <Link to="/history" className="text-sm text-gold-soft/80">← History</Link>
      <h1 className="text-center text-3xl">
        {new Date(`${data.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
      </h1>
      <FortuneView fortune={data} />
    </div>
  );
}
```

- [ ] **Step 5: Run tests, commit**

Run: `pnpm --filter @third-eye/frontend test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0. (Task 20's Today tests still pass with the richer view.)

```bash
git add -A
git commit -m "feat(frontend): full fortune view, history list and fortune detail

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: PWA — manifest and service worker

**Files:**
- Create: `apps/frontend/src/sw.ts`, `apps/frontend/src/registerSW.ts`
- Modify: `apps/frontend/package.json`, `apps/frontend/vite.config.ts`, `apps/frontend/tsconfig.json`, `apps/frontend/src/main.tsx`

**Interfaces:**
- Produces: installable PWA (`manifest.webmanifest`, `sw.js`) with precached shell; `/api/*` is never cached.

- [ ] **Step 1: Dependencies**

Run:
```bash
pnpm --filter @third-eye/frontend add workbox-precaching workbox-routing workbox-window
pnpm --filter @third-eye/frontend add -D vite-plugin-pwa
```

In `apps/frontend/tsconfig.json`, add `"vite-plugin-pwa/client"` to `types`.

- [ ] **Step 2: Service worker and registration (Plantry pattern)**

`apps/frontend/src/sw.ts`:
```ts
/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));
self.addEventListener('install', () => { void self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
```

`apps/frontend/src/registerSW.ts`:
```ts
import { registerSW } from 'virtual:pwa-register';

/**
 * Single registration path (`injectRegister: false`). When a NEW worker takes over a page that
 * already had one, reload once so the page's lazily-loaded chunks match the new precache.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  registerSW({ immediate: true });
}
```

In `apps/frontend/src/main.tsx`, add `import { registerServiceWorker } from './registerSW';` and call `registerServiceWorker();` after `createRoot(...).render(...)`.

- [ ] **Step 3: Vite config**

Replace `apps/frontend/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,          // main.tsx registers; keeps index.html free of inline script (CSP)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Third Eye', short_name: 'Third Eye', description: 'Your daily fortune, woven from many traditions',
        theme_color: '#0a0918', background_color: '#0a0918', display: 'standalone', start_url: '/', scope: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  server: { port: 5174, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } } },
});
```

`vitest` doesn't load `vite.config.ts` (it has its own config), so `virtual:pwa-register` is never resolved in tests — `main.tsx` is not imported by any test.

- [ ] **Step 4: Build and check the output**

Run: `pnpm --filter @third-eye/frontend build; ls apps/frontend/dist`
Expected: build succeeds; `dist/` contains `index.html`, `sw.js`, `manifest.webmanifest`, `assets/`. `grep -c "<script>" apps/frontend/dist/index.html` → `0` (no inline scripts).

Run: `pnpm test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0.

- [ ] **Step 5: Manual end-to-end check in the browser**

With Postgres up and a real `ANTHROPIC_API_KEY` in `.env`: `pnpm dev`, open `http://localhost:5174/api/auth/dev-login?sub=dev`. Expected: redirect to the Welcome screen → fill birth date → Begin → the ritual plays (cards flip, rune lands, six lines build, signs light up, "The oracle speaks…") → the fortune appears. Reload → no ritual, "Replay the ritual" works. History shows today. Toggle the OS "reduce motion" setting → ritual uses quick fades.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(frontend): installable pwa with precached shell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
