# Third Eye — Operations

Runbook for provisioning, deploying and operating Third Eye on S2. Sections A–B are one-time; the rest is day-2.
Every step that touches shared infrastructure is done **by you**, not by an agent.

## A. Provision (one-time)

- [x] **Step 1: Pick the port**

On S2: `ss -ltn | grep -E ':30(0[0-9]|1[0-9])\b'`. Third Eye expects **3009**. If it is taken, change the port in
`docker-compose.prod.yml`, `.github/workflows/deploy.yml` (health check) and the nginx block in step 7.

- [x] **Step 2: GitHub repo (public)**

Create `Zaphiruz/third-eye` as a **public** repo and push `main`. Because the repo is public and a self-hosted runner
will be attached:

⚠️ **Do this before step 6 registers the runner:** Settings → Actions → General → *Fork pull request workflows from
outside collaborators* → **Require approval for all external contributors** (also labeled "outside collaborators" on
some GitHub screens — set whichever wording you see). A pull request from a fork runs its own copy of `ci.yml`, so
without this approval requirement it could change `runs-on` to the self-hosted runner and execute code on S2.

1. Settings → Actions → General → *Workflow permissions* → **Read repository contents** (default token read-only).
2. Confirm only `deploy.yml` uses the self-hosted runner: `grep -n self-hosted .github/workflows/*.yml`. Even with
   "Require approval for all external contributors" on, never approve a fork PR that touches `.github/workflows/**`
   without reading the diff first — approving it lets its edited workflow run on the self-hosted runner.
3. Branch protection on `main`: require PRs from others; require the `CI` check.

The Deploy workflow will queue forever until the runner exists (step 6). Disable it until then:
`gh workflow disable deploy.yml --repo Zaphiruz/third-eye`.

- [x] **Step 3: PostgreSQL (S2)**

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

- [x] **Step 4: Authentik**

In `https://authentik.wispy-nook.casa` (admin):
1. Groups: create `third-eye-users` and `third-eye-admins`; add yourself and everyone who should use the app to `third-eye-users`, yourself to `third-eye-admins`.
2. Provider → OAuth2/OpenID: name `third-eye`, **Confidential**, redirect URI (strict) `https://third-eye.wispy-nook.casa/api/auth/callback`, signing key = default RS256 cert, **leave Encryption Key blank**, scopes `openid`, `email`, `profile` + the custom `groups` scope mapping (the one using `request.user.groups`).
3. Application: name `Third Eye`, slug `third-eye`, provider `third-eye`, launch URL `https://third-eye.wispy-nook.casa/`. Bind group `third-eye-users` under Policy/Group/User Bindings — this is the access gate.
4. Note the client id and secret for step 5.

- [x] **Step 5: Anthropic key + Vault**

Create an API key just for Third Eye at console.anthropic.com **inside a workspace** (set a monthly spend limit on the
workspace — expected cost is under a cent per fortune on Haiku). An org-level key that isn't scoped to a workspace is
rejected by the API ("must include the anthropic-workspace-id header"), and every reading ends FAILED. Then, from the repo root on your PC:
```bash
bash scripts/provision-secrets.sh
```
It prompts (hidden) for the Vault root token, the Authentik client id/secret and the Anthropic key, writes
`secret/third-eye` + policy `third-eye` on LC3, creates the periodic app token (auto-renewed weekly) and delivers it
to `S2:/root/.third-eye-vault-token`. It must end with `HTTP 200`.

Never put `AUTH_DEV_BYPASS` or `NODE_ENV` in Vault — the entrypoint ignores them and logs the key names.

- [x] **Step 6: S2 checkout, token, runner**

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

- [x] **Step 7: nginx (LC2) + Cloudflare Tunnel**

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
Do **not** add a Pi-hole override. Double-check the port is **443**: a typo (e.g. 433) shows up as a Cloudflare 502 while
nginx on LC2 answers fine locally; `journalctl -u cloudflared | grep -i "unable to reach"` on LC2 names the bad port.

## B. First deploy + verification

- [x] **Step 8: Deploy**

```bash
gh workflow enable deploy.yml --repo Zaphiruz/third-eye
gh workflow run deploy.yml --repo Zaphiruz/third-eye
```
Watch the run; the health check must pass. `gh workflow run deploy.yml` only deploys from `main` — the workflow
rejects any other ref. This first run is also the first real test of the Vault entrypoint and `prisma migrate deploy`
running from the built image, so watch the logs closely rather than assuming a clean run.

- [x] **Step 9: Verify in production**

1. `https://third-eye.wispy-nook.casa` → Authentik → back to **Welcome**. A user not in `third-eye-users` is refused by Authentik.
2. Onboard (birth date required). The browser time zone is pre-selected. **Begin** is a browser `PATCH` — confirm it passes Cloudflare.
3. The ritual plays: three cards flip, a rune lands, six lines build, signs light up, "The oracle speaks…", then the fortune appears in the chosen voice with a reading for every method.
4. Reload → no ritual; "Replay the ritual" works. History lists today; opening it shows the full fortune.
5. `docker logs third-eye-backend-1 | grep remoteAddress | tail` shows your real client IP (not `192.168.40.11` or `127.0.0.1`) → `TRUST_PROXY_HOPS=3` and the Caddy `trusted_proxies` are right.
6. `docker logs third-eye-backend-1 | grep -i "fortune interpreted"` shows `attempt: 1`; logs contain no birth dates, names or reading text.
7. Settings → switch persona → tomorrow's fortune uses the new voice (today's keeps the old one).
8. Firefox on cellular: the app loads and the fortune completes (HTTP/3 is off at the Cloudflare edge for this zone).
9. Install to home screen on a phone; it opens standalone with the dark theme.

- [x] **Step 10: Record it in the homelab doc**

In `D:\docs\Mikrotik\CLAUDE.md` add: Third Eye to the S2 port allocation (3009), `third_eye` to the shared-infra
databases, `third-eye` to the tunnel's active hostnames, `third-eye-users` / `third-eye-admins` to the Authentik
groups, the runner path, and a "Third Eye" block in the same style as Plantry's (public repo, Vault path + key list,
Anthropic key, no Redis/worker/MinIO).

## Deployment record

First deployed 2026-09-27: runner `s2-third-eye` online, deploy run green, production checks (PC + phone/PWA, first
reading READY on attempt 1 in ~9 s on Haiku, real client IPs through the proxy chain, no PII in logs) all passed, and the
homelab doc (`D:\docs\Mikrotik\CLAUDE.md`) updated. HSTS is set at the Cloudflare edge (1 month, includeSubDomains) —
raise it to 6–12 months once nothing breaks.

## Day-2 operations

**Logs:** `docker compose -f docker-compose.prod.yml logs -f backend` (look for `oracle attempt failed`).

**A fortune stuck or failed:** a `FAILED` fortune, or one `PENDING` for more than two minutes, is retried with the
same draws on the next visit — every page open calls `/today`, which re-claims it. An open Today page also re-asks
`/today` roughly every 2 minutes on its own while a reading is still pending, so a backend restart mid-interpretation
recovers on its own without the user reloading. A crash while building the prompt ends the fortune as `FAILED`
straight away, and the user can tap "Try again" to retry immediately rather than waiting out the 2-minute window.
(A `FAILED` fortune stops being retried automatically once it has accumulated 8 attempts, to cap cost on a
persistently broken reading — this is rare and shows up as a fortune stuck `FAILED` with `attempts >= 8` below.) To
inspect:
```bash
docker exec shared-infra-postgresql-1 psql -U postgres -d third_eye -c \
  "SELECT id, user_sub, date, status, attempts, last_error FROM fortunes WHERE status <> 'READY' ORDER BY date DESC LIMIT 20;"
```

**Change the model:** the default is `claude-haiku-4-5` (cheapest, ~0.7¢/reading). For richer readings use
`claude-sonnet-5` (~1.5¢) or `claude-opus-5`. `vault kv patch secret/third-eye ANTHROPIC_MODEL=<model id>` on LC3, then
`docker compose -f docker-compose.prod.yml restart backend`. New fortunes record the model used.

**Tune reading quality vs. speed/cost:** `ANTHROPIC_THINKING` is `off` by default (fastest, cheapest); set it to
`adaptive` to let the model think before writing (richer readings, slower, costs more; Sonnet/Opus only — the
backend refuses to start with adaptive on Haiku). `ANTHROPIC_EFFORT` is
`low`, `medium` (default) or `high` (ignored on Haiku). Change either with `vault kv patch secret/third-eye ANTHROPIC_THINKING=adaptive`
(or `ANTHROPIC_EFFORT=…`) on LC3, then restart the backend. An invalid value stops the backend at startup with a
clear error. If readings start timing out (`oracle attempt failed` with a timeout in the logs), lower effort or turn
thinking off.

**Rotate a secret (incl. the Anthropic key):** `vault kv patch secret/third-eye KEY=value` on LC3, then restart the backend.

**Costs:** one Claude call per user per day (plus at most one retry). Check usage in the Anthropic console.

**Backups:** the `third_eye` database is covered by S2's nightly `pg_dumpall`. There is no other state.

**Disk:** `docker builder prune -f` if builds start failing on space.
