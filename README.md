# Third Eye

A daily fortune, woven from many traditions. Each day Third Eye draws a three-card tarot spread, casts an Elder Futhark rune and an I Ching hexagram, reads your Western sun sign, Chinese zodiac, numerology and (optionally) blood type — then an AI oracle in the persona you choose interprets them together.

- `packages/divination` — pure TypeScript: every draw and calculation, plus the reference data (78 cards, 24 runes, 64 hexagrams, zodiac, Lunar New Year 1900–2100).
- `apps/backend` — Fastify + Prisma API, Authentik OIDC, the Claude-backed oracle.
- `apps/frontend` — React PWA with the ritual animation.

## Development

    corepack enable
    cp .env.example .env            # add your own ANTHROPIC_API_KEY
    docker compose up -d postgres
    pnpm install
    pnpm --filter @third-eye/backend prisma migrate dev
    pnpm --filter @third-eye/backend test:db:setup
    pnpm dev                        # backend :3001, frontend :5174

Log in locally at http://localhost:5174/api/auth/dev-login?sub=dev (dev bypass; refused in production).

    pnpm test && pnpm typecheck && pnpm lint

Design: `docs/superpowers/specs/2026-09-26-third-eye-design.md`. Operations: `OPERATIONS.md`.

Fortunes are for reflection and entertainment.
