#!/usr/bin/env bash
#
# Materialise the two files provisioning wrote, from variables, then start the portal.
#
# accounts.json and keys.json are gitignored — one names the wallets, the other holds the
# finance system's signing key — so they cannot ship in the image. They arrive as variables
# and are written where the code already looks for them.
set -euo pipefail
cd /app

if [ -n "${PRIVY_ACCOUNTS_JSON:-}" ]; then
  printf '%s' "$PRIVY_ACCOUNTS_JSON" > libs/privy/accounts.json
fi
if [ -n "${PRIVY_KEYS_JSON:-}" ]; then
  printf '%s' "$PRIVY_KEYS_JSON" > libs/privy/keys.json
fi

mkdir -p "${DEMO_STATE_DIR:-/data}"

cd "apps/${APP}"
exec npx next start --port "${PORT:-3000}" --hostname 0.0.0.0
