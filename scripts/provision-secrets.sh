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
import json, os, urllib.parse
print(json.dumps({
  "DATABASE_URL": f"postgresql://third_eye:{urllib.parse.quote(os.environ['DB_PW'], safe='')}@postgresql:5432/third_eye",
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
  "ANTHROPIC_MODEL": "claude-haiku-4-5",
  "ANTHROPIC_THINKING": "off",
  "ANTHROPIC_EFFORT": "medium",
}))
PY
)

say "== Writing policy + secrets to Vault on LC3, creating the periodic app token =="
# stdin to LC3: line 1 = root token, line 2 = JSON document. stdout from LC3 = ONLY the app token.
APP_TOKEN=$(printf '%s\n%s\n' "$VAULT_ROOT_TOKEN" "$KV_JSON" | ssh -o BatchMode=yes LC3 '
  set -euo pipefail
  export VAULT_ADDR=http://127.0.0.1:8200
  read -r VAULT_TOKEN; export VAULT_TOKEN
  umask 077; tmp=$(mktemp -p /dev/shm third-eye.XXXXXX); trap "rm -f \"\$tmp\"" EXIT HUP INT TERM
  cat > "$tmp"
  vault token lookup >/dev/null || { echo "Vault rejected the root token" >&2; exit 1; }
  printf "path \"secret/data/third-eye\" { capabilities = [\"read\"] }\n" | vault policy write third-eye - >&2
  vault kv put secret/third-eye @"$tmp" >/dev/null; echo "kv written" >&2
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
  set -euo pipefail
  code=$(printf "X-Vault-Token: %s\n" "$(cat /root/.third-eye-vault-token)" | curl -s -o /dev/null -w "%{http_code}" --cacert /usr/local/share/ca-certificates/cloudflare-origin-ca.crt \
    -H @- https://vault.wispy-nook.casa/v1/secret/data/third-eye)
  echo "GET secret/data/third-eye with the app token -> HTTP $code (want 200)" >&2
  [ "$code" = 200 ] || { echo "verification failed" >&2; exit 1; }'

unset VAULT_ROOT_TOKEN OIDC_CLIENT_SECRET ANTHROPIC_KEY SESSION_SECRET DB_PW KV_JSON APP_TOKEN
say "Done. Next: OPERATIONS step 6 (checkout on S2, move the token into place, register the runner)."
