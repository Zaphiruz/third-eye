#!/usr/bin/env bash
# Writes .env with ONLY the Vault address and this app's token; the backend fetches everything else.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
printf 'VAULT_ADDR=https://vault.wispy-nook.casa\nVAULT_TOKEN=%s\n' "$(cat vault-token)" > .env
chmod 600 .env
echo ".env written"
