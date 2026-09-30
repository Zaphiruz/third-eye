# Third Eye — Share Links Design

**Date:** 2026-09-29
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:** `2026-09-26-third-eye-design.md`

## 1. Summary

Signed-in users can share any finished (READY) fortune with people who have no account, via an unguessable read-only link. Each link carries its own "Shared by" name and its own choice of whether to include the birth-based methods. A fortune may have several links; each can be revoked independently. The public page is **server-rendered static HTML** (no JavaScript) built from the same React components the app uses, so friends see exactly what the owner sees and link previews in messaging apps are rich.

## 2. Scope

### In scope
- Create / list / revoke share links for your own READY fortunes.
- Per-share `sharedByName` (typed per share, pre-filled) and `includeBirthSigns` (default off).
- Public page `/s/:token`: shared-by name, fortune date, persona, summary, and the method cards the share allows; Open Graph / Twitter preview tags.
- Moving the fortune view and symbol components into a shared `packages/ui` used by the app and the backend.

### Out of scope
- Guest readings for non-users, share images / `og:image`, link expiry, view counts/analytics, sharing unfinished fortunes, a global "my shares" page (links are managed per fortune).

## 3. Data Model

New Prisma model (table `shares`):

```prisma
model Share {
  id                String    @id @default(uuid()) @db.Uuid
  token             String    @unique                 // 22-char base64url, crypto.randomBytes(16)
  fortuneId         String    @map("fortune_id") @db.Uuid
  userSub           String    @map("user_sub")
  sharedByName      String    @map("shared_by_name")  // 1–60 chars, trimmed
  includeBirthSigns Boolean   @default(false) @map("include_birth_signs")
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  revokedAt         DateTime? @map("revoked_at") @db.Timestamptz(6)
  fortune           Fortune   @relation(fields: [fortuneId], references: [id], onDelete: Cascade)
  user              User      @relation(fields: [userSub], references: [sub], onDelete: Cascade)
  @@index([fortuneId])
  @@map("shares")
}
```

The token is stored in plaintext so the owner can copy an existing link again; it is a bearer capability equivalent in sensitivity to the fortune it exposes. Revocation is a soft delete (`revokedAt`).

**Birth-based methods** (hidden unless `includeBirthSigns`): `WESTERN`, `CHINESE`, `NUMEROLOGY`, `BLOODTYPE`. Always shown: `TAROT`, `RUNE`, `ICHING`, the persona, and the summary (which may still mention birth signs — the UI says so).

## 4. API

Error code added to `ERROR_CODES`: `not_ready` (409).

| Route | Auth | Behaviour |
|---|---|---|
| `POST /api/fortunes/:id/shares` | session + same-origin | Body `{ sharedByName: string (trimmed, 1–60), includeBirthSigns: boolean }` (strict zod). 404 if the fortune isn't the caller's; 409 `not_ready` unless READY. Returns `201 { data: ShareDto }`. Rate limit 20/min. |
| `GET /api/fortunes/:id/shares` | session | 404 if not the caller's fortune. `{ data: ShareDto[] }` — active (non-revoked) shares, newest first. |
| `DELETE /api/shares/:id` | session + same-origin | Sets `revokedAt` on the caller's own active share; 404 otherwise (incl. already revoked). `204`. |
| `GET /s/:token` | public | See §5. |

```ts
// packages/shared
export interface ShareDto {
  id: string; url: string;              // `${FRONTEND_ORIGIN}/s/${token}`
  sharedByName: string; includeBirthSigns: boolean; createdAt: string;
}
export const shareCreateSchema; // zod: { sharedByName, includeBirthSigns }
```

## 5. Public Page (`GET /s/:token`)

- Token format checked (`^[A-Za-z0-9_-]{22}$`) before any DB query; unknown, malformed or revoked → the same "This link is no longer active" page with **404**, revealing nothing about whether it existed.
- Found → **200** HTML page rendered with `react-dom/server` `renderToStaticMarkup`:
  - Header: "Third Eye" wordmark, "Shared by {sharedByName}", date formatted like "Monday, September 29" (UTC-noon trick, as the app does).
  - Body: the shared `FortuneView` from `@third-eye/ui` with results filtered per `includeBirthSigns`.
  - Footer: "Third Eye — for reflection and entertainment."
  - `<head>`: `<title>`, `og:title` = "{name}'s fortune — {Mon D}", `og:description` = "{card1}, {card2}, {card3} · {rune} · Hexagram {n}: {name}" (orientations noted, e.g. "The Tower (reversed)"), `og:site_name` = "Third Eye", `og:type` = "article", `twitter:card` = "summary", `<meta name="robots" content="noindex">`, theme-color.
  - All user-controlled text (name, summary, readings) is escaped by React; nothing uses `dangerouslySetInnerHTML` except the inlined build-time CSS.
- Response headers: `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`.
- Rate limit: 60/min per IP.
- Fonts: Cormorant Garamond woff2 (400, 600) resolved from `@fontsource/cormorant-garamond` in the backend's `node_modules` at runtime and served at `/s/assets/<file>` with `Cache-Control: public, max-age=31536000, immutable`.
- Styles: a Tailwind build (same theme as the app, content = `packages/ui/src/**` + the page template) produces `share.css` at backend build time; the page inlines it in a `<style>` tag.

## 6. Shared UI Package

`packages/ui` (`@third-eye/ui`): `FortuneView`, `MethodCard`, `MiniSymbols`, `symbols/TarotCard`, `RuneStone`, `Hexagram`, `SignRing` (+ `signItems`), moved unchanged from `apps/frontend/src/components`, with their tests. Depends on `react`, `@third-eye/divination`, `@third-eye/shared`. The frontend imports them from `@third-eye/ui`; its Tailwind content globs include `packages/ui/src/**`. Components must stay render-to-string safe: no browser globals at render time (`useId` is fine).

## 7. App UI

- **Share** button on `FortuneView` pages (Today and History detail) when status is READY → dialog:
  - "Shared by" text input, pre-filled with `profile.fullName ?? user.name`, 1–60 chars.
  - "Include birth-based signs" checkbox, default off, hint: "Adds your sun sign, Chinese zodiac, numbers and blood type. The written summary may still mention them."
  - "Create link" → shows the URL with **Copy** (Clipboard API) and, where `navigator.share` exists, **Share…**.
  - List of this fortune's active links (name, "with/without signs", created date) with **Copy** and **Stop sharing** (confirm).
- Errors inline in the dialog; `not_ready` → "This reading isn't finished yet."
- RTK Query: `createShare`, `getShares` (tag `Shares` per fortune id), `revokeShare`.

## 8. Routing

Caddyfile: `handle /s/* { reverse_proxy backend:3000 }` placed before the SPA catch-all. The service worker's navigation fallback already only covers app routes via `createHandlerBoundToURL('/index.html')` — add `^/s/` to its denylist so an installed PWA doesn't swallow share links.

## 9. Testing

- **Backend (real Postgres):** create/list/revoke; other user's fortune/share → 404; not READY → 409 `not_ready`; strict body validation; revoked share disappears from list; public page 200 contains name, date, persona, summary, the three draws; birth-based sections present only with `includeBirthSigns`; revoked/unknown/malformed token → 404 page; headers (no-store, noindex, CSP, no-referrer); no `<script` in output; `sharedByName` containing `<script>` is escaped; OG tags present and correct; fonts route serves woff2 with immutable caching.
- **packages/ui:** moved component tests pass from their new home; a smoke test that `renderToStaticMarkup(<FortuneView …/>)` works in a Node environment.
- **Frontend:** dialog pre-fills name, checkbox defaults off, create shows URL, list shows links, Stop sharing removes after confirm, Share button hidden unless READY.
- **Manual:** paste a link into Messages and WhatsApp (preview), open in a private window, revoke and reload.
