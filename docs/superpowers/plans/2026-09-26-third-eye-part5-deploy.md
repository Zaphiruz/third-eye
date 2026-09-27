# Third Eye — Part 5: Production (Tasks 23–25)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Read the index first: [2026-09-26-third-eye.md](2026-09-26-third-eye.md). This part depends on everything before it. It produces the container images, the deploy pipeline and the runbook. **Agents do not touch shared infrastructure** (Authentik, Vault, PostgreSQL on S2, nginx on LC2, Cloudflare, GitHub repo settings): Task 25 writes those steps into `OPERATIONS.md` as a checklist the user performs.

Homelab facts used below come from `D:\docs\Mikrotik\CLAUDE.md` (S2 = `192.168.40.20`, LC2 = `192.168.40.11`, shared Postgres alias `postgresql` on network `shared-db`, Vault at `https://vault.wispy-nook.casa`, Origin CA at `/usr/local/share/ca-certificates/cloudflare-origin-ca.crt`). Frontend port **3009** is the next free one after Plantry's 3008 — the runbook verifies it with `ss -ltn` before first deploy.

---

### Task 23: Production images, entrypoint, Caddyfile, prod compose

**Files:**
- Create: `apps/backend/Dockerfile`, `apps/backend/entrypoint.mjs`, `apps/backend/env-filter.mjs`, `apps/backend/env-filter.d.mts`
- Create: `apps/frontend/Dockerfile`, `apps/frontend/Caddyfile`
- Create: `docker-compose.prod.yml`
- Test: `apps/backend/src/env-filter.test.ts`

**Interfaces:**
- Consumes: built backend (`apps/backend/dist/server.js`), built frontend (`apps/frontend/dist`).
- Produces: images `third-eye-backend:latest` (listens on 3000, `/health` HEALTHCHECK) and `third-eye-frontend:latest` (Caddy on 80, proxies `/api/*` → `backend:3000`); `filterSecrets(secrets)` + `PROTECTED_ENV_KEYS`.

- [ ] **Step 1: Write the failing env-filter test**

`apps/backend/src/env-filter.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PROTECTED_ENV_KEYS, filterSecrets } from '../env-filter.mjs';

describe('filterSecrets', () => {
  it('applies ordinary keys and refuses protected ones (names only)', () => {
    const { applied, ignored } = filterSecrets({ DATABASE_URL: 'pg://x', NODE_ENV: 'development', AUTH_DEV_BYPASS: '1', ANTHROPIC_API_KEY: 'k' });
    expect(applied).toEqual({ DATABASE_URL: 'pg://x', ANTHROPIC_API_KEY: 'k' });
    expect(ignored.sort()).toEqual(['AUTH_DEV_BYPASS', 'NODE_ENV']);
  });
  it('protects the keys that change what code runs', () => {
    expect([...PROTECTED_ENV_KEYS].sort()).toEqual(['AUTH_DEV_BYPASS', 'NODE_ENV', 'NODE_EXTRA_CA_CERTS', 'NODE_OPTIONS', 'PATH', 'TZ']);
  });
  it('tolerates an empty secret bag', () => {
    expect(filterSecrets(null)).toEqual({ applied: {}, ignored: [] });
  });
});
```

Run: `pnpm --filter @third-eye/backend exec vitest run src/env-filter.test.ts`
Expected: FAIL — cannot resolve `../env-filter.mjs`.

- [ ] **Step 2: Entrypoint and filter (Plantry pattern)**

`apps/backend/env-filter.mjs`:
```js
/**
 * Environment keys Vault secrets must never set. NODE_ENV / AUTH_DEV_BYPASS decide whether the
 * dev auth bypass is legal; NODE_* and PATH change what code the process loads.
 */
export const PROTECTED_ENV_KEYS = Object.freeze([
  'NODE_ENV', 'AUTH_DEV_BYPASS', 'NODE_OPTIONS', 'NODE_EXTRA_CA_CERTS', 'TZ', 'PATH',
]);

/** Split a Vault secret bag into values to apply and the key NAMES (never values) that were ignored. */
export function filterSecrets(secrets) {
  const applied = {};
  const ignored = [];
  for (const [key, value] of Object.entries(secrets ?? {})) {
    if (PROTECTED_ENV_KEYS.includes(key)) ignored.push(key);
    else applied[key] = value;
  }
  return { applied, ignored };
}
```

`apps/backend/env-filter.d.mts`:
```ts
export declare const PROTECTED_ENV_KEYS: readonly string[];
export declare function filterSecrets(
  secrets: Record<string, string> | null | undefined,
): { applied: Record<string, string>; ignored: string[] };
```

`apps/backend/entrypoint.mjs`:
```js
import { spawn } from 'node:child_process';
import { filterSecrets } from './env-filter.mjs';

const { VAULT_ADDR, VAULT_TOKEN } = process.env;
if (!VAULT_ADDR || !VAULT_TOKEN) {
  console.error('[entrypoint] VAULT_ADDR and VAULT_TOKEN must be set');
  process.exit(1);
}
console.log('[entrypoint] Fetching secrets from Vault...');
const res = await fetch(`${VAULT_ADDR}/v1/secret/data/third-eye`, { headers: { 'X-Vault-Token': VAULT_TOKEN } });
if (!res.ok) {
  console.error(`[entrypoint] Vault responded ${res.status}`);
  process.exit(1);
}
const { data: { data: secrets } } = await res.json();
const { applied, ignored } = filterSecrets(secrets);
if (ignored.length) console.warn(`[entrypoint] Ignored protected key(s) from Vault: ${ignored.join(', ')}`);
Object.assign(process.env, applied);
console.log('[entrypoint] Secrets loaded, starting server...');

const child = spawn(process.execPath, ['apps/backend/dist/server.js'], { stdio: 'inherit', env: process.env });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('exit', (code) => process.exit(code ?? 0));
```

In `apps/backend/tsconfig.json`, no change is needed: the test imports the `.mjs` and TypeScript picks up the sibling `.d.mts`.

Run: `pnpm --filter @third-eye/backend exec vitest run src/env-filter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Backend Dockerfile**

`apps/backend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/divination/package.json packages/divination/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY packages/divination packages/divination
COPY apps/backend apps/backend
RUN pnpm --filter @third-eye/backend exec prisma generate
RUN pnpm --filter @third-eye/backend build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl tzdata
WORKDIR /repo
ENV NODE_ENV=production
# Owned by `node`: the Prisma CLI needs a writable engines dir, and `prisma migrate deploy` runs from this image.
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/package.json ./
COPY --from=build --chown=node:node /repo/apps/backend/dist apps/backend/dist
COPY --from=build --chown=node:node /repo/apps/backend/package.json apps/backend/
COPY --from=build --chown=node:node /repo/apps/backend/node_modules apps/backend/node_modules
COPY --from=build --chown=node:node /repo/apps/backend/prisma apps/backend/prisma
COPY --chown=node:node apps/backend/entrypoint.mjs apps/backend/env-filter.mjs apps/backend/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/backend/entrypoint.mjs"]
```
(`tsup` bundles `@third-eye/shared` and `@third-eye/divination` into `dist/server.js` via `noExternal`, so the runtime image doesn't need those packages' sources.)

- [ ] **Step 4: Frontend Dockerfile and Caddyfile**

`apps/frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/divination/package.json packages/divination/
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY packages/divination packages/divination
COPY apps/frontend apps/frontend
RUN pnpm --filter @third-eye/frontend exec vite build

FROM caddy:2-alpine AS runtime
COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/frontend/dist /srv
EXPOSE 80
```

`apps/frontend/Caddyfile`:
```caddyfile
# Trust ONLY LC2 (192.168.40.11) as a proxy so its X-Forwarded-For survives; anything else connecting
# directly has its X-Forwarded-For discarded. Chain: Cloudflare edge -> cloudflared (LC2) -> nginx (LC2)
# -> Caddy -> backend, which is why the backend runs with TRUST_PROXY_HOPS=3.
{
  servers {
    trusted_proxies static 192.168.40.11/32
  }
}

# Caddy applies only ONE matching `header` directive per request, so each handle block sets its
# security headers and its Cache-Control together. Fonts are self-hosted; 'unsafe-inline' styles are
# needed for animation style attributes.
(security_headers) {
  X-Content-Type-Options "nosniff"
  Referrer-Policy "strict-origin-when-cross-origin"
  X-Frame-Options "DENY"
  Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
}

:80 {
  encode gzip zstd

  handle /api/* {
    header {
      X-Content-Type-Options "nosniff"
      Referrer-Policy "strict-origin-when-cross-origin"
      X-Frame-Options "DENY"
    }
    reverse_proxy backend:3000
  }

  # Hashed build output is immutable.
  handle /assets/* {
    root * /srv
    header {
      import security_headers
      Cache-Control "public, max-age=31536000, immutable"
    }
    file_server
  }

  # index.html, sw.js, manifest and SPA routes must revalidate, or clients get stranded on an old build.
  handle {
    root * /srv
    header {
      import security_headers
      Cache-Control "no-cache"
    }
    try_files {path} /index.html
    file_server
  }
}
```

- [ ] **Step 5: Production compose**

`docker-compose.prod.yml`:
```yaml
x-logging: &default-logging
  driver: json-file
  options: { max-size: "10m", max-file: "3" }

services:
  backend:
    build: { context: ., dockerfile: apps/backend/Dockerfile }
    image: third-eye-backend:latest
    restart: unless-stopped
    env_file: .env            # VAULT_ADDR + VAULT_TOKEN only; everything else comes from Vault at start
    environment:
      TZ: America/New_York
      NODE_EXTRA_CA_CERTS: /etc/ssl/extra/cloudflare-ca.crt
    volumes:
      - /usr/local/share/ca-certificates/cloudflare-origin-ca.crt:/etc/ssl/extra/cloudflare-ca.crt:ro
    networks: [default, shared-db]
    logging: *default-logging

  frontend:
    build: { context: ., dockerfile: apps/frontend/Dockerfile }
    image: third-eye-frontend:latest
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    ports: ["192.168.40.20:3009:80"]   # LAN address only; nginx on LC2 is the only intended client
    logging: *default-logging

networks:
  shared-db:
    external: true
```
(`TZ` only affects log timestamps — each fortune's "today" comes from the user's own time zone.)

- [ ] **Step 6: Build both images locally**

Run (Docker Desktop running):
```bash
docker build -f apps/backend/Dockerfile -t third-eye-backend:local .
docker build -f apps/frontend/Dockerfile -t third-eye-frontend:local .
```
Expected: both builds succeed.

Smoke-test the backend image refuses to start without Vault:
```bash
docker run --rm third-eye-backend:local
```
Expected: exits 1 with `[entrypoint] VAULT_ADDR and VAULT_TOKEN must be set`.

- [ ] **Step 7: Run everything, commit**

Run: `pnpm test; pnpm typecheck; pnpm lint`
Expected: PASS / exit 0.

```bash
git add -A
git commit -m "build: production images, vault entrypoint, caddy config and prod compose

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 24: Deploy workflow and secrets scripts

**Files:**
- Create: `.github/workflows/deploy.yml`, `fetch-secrets.sh`, `scripts/provision-secrets.sh`

**Interfaces:**
- Consumes: `docker-compose.prod.yml`, `/opt/third-eye/vault-token` on S2.
- Produces: a deploy that runs on the S2 runner (labels `self-hosted, third-eye`) only after CI passed on a same-repo push to `main`; a one-shot provisioning script the user runs.

**Public-repo safety (spec §10):** CI (`ci.yml`) runs on GitHub-hosted runners for every event. `deploy.yml` is the **only** workflow that uses the self-hosted runner, it triggers only on `workflow_run` (CI completed) or manual dispatch, and its job-level `if` rejects runs that did not come from a `push` to `main` of this same repository. It never checks out PR code, never uses `pull_request_target`, and has `permissions: {}`.

- [ ] **Step 1: Deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
  workflow_dispatch: {}

# Nothing here talks to the GitHub API; the runner uses the checkout already on disk.
permissions: {}

concurrency: { group: deploy, cancel-in-progress: false }

jobs:
  deploy:
    # workflow_run also fires for CI runs on forks' PRs. These guards make sure only a green CI run
    # for a push to main of THIS repository can reach the self-hosted runner.
    if: >-
      ${{ github.event_name == 'workflow_dispatch' ||
          (github.event.workflow_run.conclusion == 'success' &&
           github.event.workflow_run.event == 'push' &&
           github.event.workflow_run.head_branch == 'main' &&
           github.event.workflow_run.head_repository.full_name == github.repository) }}
    runs-on: [self-hosted, third-eye]
    defaults: { run: { working-directory: /opt/third-eye } }
    steps:
      - name: Check out the exact commit CI validated
        run: |
          set -euo pipefail
          git fetch origin
          git checkout --detach "${{ github.event.workflow_run.head_sha || github.sha }}"

      - name: Build images
        run: |
          set -e
          for i in 1 2 3; do
            if docker compose -f docker-compose.prod.yml build backend frontend; then exit 0; fi
            echo "Attempt $i failed, retrying..."; sleep 10
          done
          echo "Build failed after 3 attempts."; exit 1

      - name: Run migrations (before the new code starts)
        run: |
          set -euo pipefail
          source .env
          DB_URL=$(curl -sf -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/secret/data/third-eye" \
            | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['data']['DATABASE_URL'])")
          docker compose -f docker-compose.prod.yml run --rm --no-deps -e DATABASE_URL="$DB_URL" backend \
            apps/backend/node_modules/.bin/prisma migrate deploy --schema apps/backend/prisma/schema.prisma

      - name: Deploy
        run: docker compose -f docker-compose.prod.yml up -d

      - name: Health check
        run: |
          for i in $(seq 1 20); do
            if curl -sf http://192.168.40.20:3009/api/ready; then echo healthy; exit 0; fi
            sleep 3
          done
          docker compose -f docker-compose.prod.yml logs --tail 80 backend; exit 1

      - name: Prune dangling images (S2 has a 64 GB disk)
        run: docker image prune -f
```

- [ ] **Step 2: `fetch-secrets.sh`**

`fetch-secrets.sh`:
```bash
#!/usr/bin/env bash
# Writes .env with ONLY the Vault address and this app's token; the backend fetches everything else.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
printf 'VAULT_ADDR=https://vault.wispy-nook.casa\nVAULT_TOKEN=%s\n' "$(cat vault-token)" > .env
echo ".env written"
```

Run: `git update-index --chmod=+x fetch-secrets.sh` after adding it (Windows doesn't record the executable bit otherwise).

- [ ] **Step 3: `scripts/provision-secrets.sh`**

`scripts/provision-secrets.sh`:
```bash
#!/usr/bin/env bash
# One-time: put every Third Eye secret into Vault (LC3) and deliver the app's Vault token to S2.
# Run it yourself, from the repo root, in Git Bash:   bash scripts/provision-secrets.sh
#
# Nothing secret is printed, written to this machine's disk, or put on a command line:
#   - you type what only you have (hidden input): Vault root token, Authentik client secret, Anthropic API key
#   - SESSION_SECRET is generated here, in memory
#   - the DB password is read from S2:/root/.third-eye-db-pw (OPERATIONS step 3)
#   - everything travels over ssh stdin into `vault kv put`; the periodic app token travels
#     LC3 -> here (in a variable) -> S2:/root/.third-eye-vault-token (mode 600)
#
# Prerequisites: `ssh S2` and `ssh LC3` work; Vault is unsealed; OPERATIONS steps 3 and 4 are done.
# Safe to re-run: the KV write is a full replace; an existing app token is reused.
set -euo pipefail

say() { printf '%s\n' "$*" >&2; }
ask_secret() { local v; read -r -s -p "$1: " v; echo >&2; printf '%s' "$v"; }
ask() { local v; read -r -p "$1: " v; printf '%s' "$v"; }

[ -f apps/backend/package.json ] || { say "Run from the repo root."; exit 1; }

say "== Things only you have (input is hidden) =="
VAULT_ROOT_TOKEN=$(ask_secret "Vault root token (1Password)")
OIDC_CLIENT_ID=$(ask "Authentik client ID (provider 'third-eye')")
OIDC_CLIENT_SECRET=$(ask_secret "Authentik client secret")
ANTHROPIC_KEY=$(ask_secret "Anthropic API key (console.anthropic.com, a key just for Third Eye)")
[ -n "$VAULT_ROOT_TOKEN" ] && [ -n "$OIDC_CLIENT_ID" ] && [ -n "$OIDC_CLIENT_SECRET" ] && [ -n "$ANTHROPIC_KEY" ] \
  || { say "All four values are required."; exit 1; }

say "== Generating SESSION_SECRET (in memory) =="
SESSION_SECRET=$(openssl rand -hex 32)

say "== Reading the DB password from S2 =="
DB_PW=$(ssh -o BatchMode=yes S2 'cat /root/.third-eye-db-pw')
[ -n "$DB_PW" ] || { say "Missing /root/.third-eye-db-pw on S2 (OPERATIONS step 3)."; exit 1; }

say "== Building the secret document =="
export SESSION_SECRET DB_PW OIDC_CLIENT_ID OIDC_CLIENT_SECRET ANTHROPIC_KEY
KV_JSON=$(python - <<'PY'
import json, os
print(json.dumps({
  "DATABASE_URL": f"postgresql://third_eye:{os.environ['DB_PW']}@postgresql:5432/third_eye",
  "SESSION_SECRET": os.environ["SESSION_SECRET"],
  "SESSION_COOKIE_SECURE": "true",
  "FRONTEND_ORIGIN": "https://third-eye.wispy-nook.casa",
  "TRUST_PROXY_HOPS": "3",   # cloudflared -> nginx (both LC2) -> Caddy; Caddy trusts only LC2
  "AUTHENTIK_ISSUER_URL": "https://authentik.wispy-nook.casa/application/o/third-eye/",
  "AUTHENTIK_CLIENT_ID": os.environ["OIDC_CLIENT_ID"],
  "AUTHENTIK_CLIENT_SECRET": os.environ["OIDC_CLIENT_SECRET"],
  "AUTHENTIK_REDIRECT_URI": "https://third-eye.wispy-nook.casa/api/auth/callback",
  "AUTHENTIK_ADMIN_GROUP": "third-eye-admins",
  "ANTHROPIC_API_KEY": os.environ["ANTHROPIC_KEY"],
  "ANTHROPIC_MODEL": "claude-sonnet-5",
}))
PY
)

say "== Writing policy + secrets to Vault on LC3, creating the periodic app token =="
# stdin to LC3: line 1 = root token, line 2 = JSON document. stdout from LC3 = ONLY the app token.
APP_TOKEN=$(printf '%s\n%s\n' "$VAULT_ROOT_TOKEN" "$KV_JSON" | ssh -o BatchMode=yes LC3 '
  set -euo pipefail
  export VAULT_ADDR=http://127.0.0.1:8200
  read -r VAULT_TOKEN; export VAULT_TOKEN
  umask 077; tmp=$(mktemp -p /dev/shm third-eye.XXXXXX); trap "rm -f $tmp" EXIT
  cat > "$tmp"
  vault token lookup >/dev/null || { echo "Vault rejected the root token" >&2; exit 1; }
  printf "path \"secret/data/third-eye\" { capabilities = [\"read\"] }\n" | vault policy write third-eye - >&2
  vault kv put secret/third-eye @"$tmp" >/dev/null && echo "kv written" >&2
  if ! grep -q "^third-eye " /opt/vault/app-tokens 2>/dev/null; then
    bash /opt/vault/add-app-token.sh third-eye third-eye >&2
  else
    echo "app token for third-eye already exists - reusing it" >&2
  fi
  grep "^third-eye " /opt/vault/app-tokens | tail -1 | cut -d" " -f2
')
[ -n "$APP_TOKEN" ] || { say "No app token came back from LC3."; exit 1; }

say "== Delivering the app token to S2:/root/.third-eye-vault-token (mode 600) =="
printf '%s' "$APP_TOKEN" | ssh -o BatchMode=yes S2 'umask 077; cat > /root/.third-eye-vault-token'

say "== Verifying the app token can read the secret (from S2, via the same URL the container uses) =="
ssh -o BatchMode=yes S2 '
  code=$(curl -s -o /dev/null -w "%{http_code}" --cacert /usr/local/share/ca-certificates/cloudflare-origin-ca.crt \
    -H "X-Vault-Token: $(cat /root/.third-eye-vault-token)" https://vault.wispy-nook.casa/v1/secret/data/third-eye)
  echo "GET secret/data/third-eye with the app token -> HTTP $code (want 200)" >&2'

unset VAULT_ROOT_TOKEN OIDC_CLIENT_SECRET ANTHROPIC_KEY SESSION_SECRET DB_PW KV_JSON APP_TOKEN
say "Done. Next: OPERATIONS step 6 (checkout on S2, move the token into place, register the runner)."
```

Run: `git update-index --chmod=+x scripts/provision-secrets.sh` after adding it.

- [ ] **Step 4: Lint the shell scripts and workflow**

Run (if available): `shellcheck fetch-secrets.sh scripts/provision-secrets.sh`
Expected: no errors (warnings about the single-quoted remote script are expected and fine).

Check the workflow YAML parses: `node -e "require('fs').readFileSync('.github/workflows/deploy.yml','utf8')"` and review that `runs-on` is `[self-hosted, third-eye]` and nothing in `ci.yml` mentions `self-hosted`:
```bash
grep -n "self-hosted" .github/workflows/*.yml
```
Expected: only `deploy.yml` matches.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ci: gated self-hosted deploy workflow and vault provisioning scripts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 25: OPERATIONS.md runbook and homelab docs entry

**Files:**
- Create: `OPERATIONS.md`, `README.md`
- Modify (outside the repo, only after the user confirms production works): `D:\docs\Mikrotik\CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the user's step-by-step checklist for the shared-infrastructure work and first deploy.

- [ ] **Step 1: Write `README.md`**

`README.md`:
```markdown
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
```

- [ ] **Step 2: Write `OPERATIONS.md`**

`OPERATIONS.md`:
````markdown
# Third Eye — Operations

Runbook for provisioning, deploying and operating Third Eye on S2. Sections A–B are one-time; the rest is day-2.
Every step that touches shared infrastructure is done **by you**, not by an agent.

## A. Provision (one-time)

- [ ] **Step 1: Pick the port**

On S2: `ss -ltn | grep -E ':30(0[0-9]|1[0-9])\b'`. Third Eye expects **3009**. If it is taken, change the port in
`docker-compose.prod.yml`, `.github/workflows/deploy.yml` (health check) and the nginx block in step 7.

- [ ] **Step 2: GitHub repo (public)**

Create `Zaphiruz/third-eye` as a **public** repo and push `main`. Because the repo is public and a self-hosted runner
will be attached:
1. Settings → Actions → General → *Fork pull request workflows from outside collaborators* → **Require approval for all outside collaborators**.
2. Settings → Actions → General → *Workflow permissions* → **Read repository contents** (default token read-only).
3. Confirm only `deploy.yml` uses the self-hosted runner: `grep -n self-hosted .github/workflows/*.yml`.
4. Branch protection on `main`: require PRs from others; require the `CI` check.

The Deploy workflow will queue forever until the runner exists (step 6). Disable it until then:
`gh workflow disable deploy.yml --repo Zaphiruz/third-eye`.

- [ ] **Step 3: PostgreSQL (S2)**

```bash
sudo sh -c 'umask 077; openssl rand -hex 24 > /root/.third-eye-db-pw'
PW=$(sudo cat /root/.third-eye-db-pw)
docker exec shared-infra-postgresql-1 psql -U postgres -c "CREATE USER third_eye WITH PASSWORD '$PW';"
docker exec shared-infra-postgresql-1 psql -U postgres -c "CREATE DATABASE third_eye OWNER third_eye TEMPLATE template0;"
docker exec shared-infra-postgresql-1 psql -U postgres -d third_eye -c "
  GRANT ALL PRIVILEGES ON SCHEMA public TO third_eye;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO third_eye;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO third_eye;"
unset PW
```
(`TEMPLATE template0` sidesteps the known `template1` collation mismatch on this server.)

- [ ] **Step 4: Authentik**

In `https://authentik.wispy-nook.casa` (admin):
1. Groups: create `third-eye-users` and `third-eye-admins`; add yourself and everyone who should use the app to `third-eye-users`, yourself to `third-eye-admins`.
2. Provider → OAuth2/OpenID: name `third-eye`, **Confidential**, redirect URI (strict) `https://third-eye.wispy-nook.casa/api/auth/callback`, signing key = default RS256 cert, **leave Encryption Key blank**, scopes `openid`, `email`, `profile` + the custom `groups` scope mapping (the one using `request.user.groups`).
3. Application: name `Third Eye`, slug `third-eye`, provider `third-eye`, launch URL `https://third-eye.wispy-nook.casa/`. Bind group `third-eye-users` under Policy/Group/User Bindings — this is the access gate.
4. Note the client id and secret for step 5.

- [ ] **Step 5: Anthropic key + Vault**

Create an API key just for Third Eye at console.anthropic.com (set a monthly spend limit on the workspace — expected
cost is about a cent per fortune). Then, from the repo root on your PC:
```bash
bash scripts/provision-secrets.sh
```
It prompts (hidden) for the Vault root token, the Authentik client id/secret and the Anthropic key, writes
`secret/third-eye` + policy `third-eye` on LC3, creates the periodic app token (auto-renewed weekly) and delivers it
to `S2:/root/.third-eye-vault-token`. It must end with `HTTP 200`.

Never put `AUTH_DEV_BYPASS` or `NODE_ENV` in Vault — the entrypoint ignores them and logs the key names.

- [ ] **Step 6: S2 checkout, token, runner**

The repo is public, so no deploy key is needed:
```bash
sudo mkdir -p /opt/third-eye && sudo chown runner:runner /opt/third-eye
sudo -u runner git clone https://github.com/Zaphiruz/third-eye.git /opt/third-eye
sudo install -o runner -g runner -m 400 /root/.third-eye-vault-token /opt/third-eye/vault-token
sudo rm /root/.third-eye-vault-token
cd /opt/third-eye && sudo -u runner bash fetch-secrets.sh
```
Register a runner as the homelab doc describes, in `/opt/actions-runner-third-eye`, **scoped to this repo only**,
with the extra label `third-eye` (`./config.sh --url https://github.com/Zaphiruz/third-eye --token <fresh token> --labels third-eye --name s2-third-eye`),
then `sudo ./svc.sh install runner && sudo ./svc.sh start`.

- [ ] **Step 7: nginx (LC2) + Cloudflare Tunnel**

Append to `/etc/nginx/sites-enabled/wispy-nook.casa` on LC2:
```nginx
server {
    listen 443 ssl;
    server_name third-eye.wispy-nook.casa;
    ssl_certificate     /etc/nginx/certs/cloudflare-origin.pem;
    ssl_certificate_key /etc/nginx/certs/cloudflare-origin.key;
    client_max_body_size 64k;
    location / {
        proxy_pass http://192.168.40.20:3009;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
`nginx -t && systemctl reload nginx`. Cloudflare Zero Trust → the existing tunnel → Public Hostname
`third-eye.wispy-nook.casa` → `https://localhost:443`, Origin Server Name `third-eye.wispy-nook.casa`.
Do **not** add a Pi-hole override.

## B. First deploy + verification

- [ ] **Step 8: Deploy**

```bash
gh workflow enable deploy.yml --repo Zaphiruz/third-eye
gh workflow run deploy.yml --repo Zaphiruz/third-eye
```
Watch the run; the health check must pass.

- [ ] **Step 9: Verify in production**

1. `https://third-eye.wispy-nook.casa` → Authentik → back to **Welcome**. A user not in `third-eye-users` is refused by Authentik.
2. Onboard (birth date required). The browser time zone is pre-selected. **Begin** is a browser `PATCH` — confirm it passes Cloudflare.
3. The ritual plays: three cards flip, a rune lands, six lines build, signs light up, "The oracle speaks…", then the fortune appears in the chosen voice with a reading for every method.
4. Reload → no ritual; "Replay the ritual" works. History lists today; opening it shows the full fortune.
5. `docker logs third-eye-backend-1 | grep remoteAddress | tail` shows your real client IP (not `192.168.40.11` or `127.0.0.1`) → `TRUST_PROXY_HOPS=3` and the Caddy `trusted_proxies` are right.
6. `docker logs third-eye-backend-1 | grep -i "fortune interpreted"` shows `attempt: 1`; logs contain no birth dates, names or reading text.
7. Settings → switch persona → tomorrow's fortune uses the new voice (today's keeps the old one).
8. Firefox on cellular: the app loads and the fortune completes (HTTP/3 is off at the Cloudflare edge for this zone).
9. Install to home screen on a phone; it opens standalone with the dark theme.

- [ ] **Step 10: Record it in the homelab doc**

In `D:\docs\Mikrotik\CLAUDE.md` add: Third Eye to the S2 port allocation (3009), `third_eye` to the shared-infra
databases, `third-eye` to the tunnel's active hostnames, `third-eye-users` / `third-eye-admins` to the Authentik
groups, the runner path, and a "Third Eye" block in the same style as Plantry's (public repo, Vault path + key list,
Anthropic key, no Redis/worker/MinIO).

## Day-2 operations

**Logs:** `docker compose -f docker-compose.prod.yml logs -f backend` (look for `oracle attempt failed`).

**A fortune stuck or failed:** the user just reopens the app — a `FAILED` fortune or one `PENDING` for more than two
minutes is retried automatically on the next visit, with the same draws. To inspect:
```bash
docker exec shared-infra-postgresql-1 psql -U postgres -d third_eye -c \
  "SELECT id, user_sub, date, status, attempts, last_error FROM fortunes WHERE status <> 'READY' ORDER BY date DESC LIMIT 20;"
```

**Change the model:** `vault kv patch secret/third-eye ANTHROPIC_MODEL=<model id>` on LC3, then
`docker compose -f docker-compose.prod.yml restart backend`. New fortunes record the model used.

**Rotate a secret (incl. the Anthropic key):** `vault kv patch secret/third-eye KEY=value` on LC3, then restart the backend.

**Costs:** one Claude call per user per day (plus at most one retry). Check usage in the Anthropic console.

**Backups:** the `third_eye` database is covered by S2's nightly `pg_dumpall`. There is no other state.

**Disk:** `docker builder prune -f` if builds start failing on space.
````

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: operations runbook and readme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand off to the user**

Tell the user that sections A–B of `OPERATIONS.md` are theirs to perform (they touch Authentik, Vault, S2, LC2, Cloudflare and GitHub settings), and that step 10's homelab-doc update should happen after step 9 passes. Do not edit `D:\docs\Mikrotik\CLAUDE.md` until they confirm production works.
