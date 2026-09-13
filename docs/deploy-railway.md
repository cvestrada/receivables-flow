# Deploy to Railway

Two services from this one repo, each built from `docker/Dockerfile` with a different `APP`.
A volume on the business service keeps the three demo state files between requests.

## Once: create the project

1. Railway → New Project → Deploy from GitHub repo → `cvestrada/receivables-flow`.
2. It creates one service. Rename it **business**. Settings → Config-as-code path: `apps/business/railway.toml`.
3. Add a second service from the same repo. Rename it **investor**. Config path: `apps/investor/railway.toml`.
4. On **business** → Settings → Volumes → mount a volume at `/data`.
5. Generate a public domain for each service (Settings → Networking).

## Variables

Set on **both** services (Variables → Raw editor is quickest; paste from `.env.local`):

```
NEXT_PUBLIC_PRIVY_APP_ID
PRIVY_APP_ID
PRIVY_APP_SECRET
PRIVY_BUSINESS_DIRECTOR_EMAILS
PRIVY_FUND_AUTHORIZATION_KEY
PRIVY_FUND_AUTHORIZATION_KEY_ID
HEDERA_OPERATOR_WALLET_PRIVATE_KEY
HEDERA_BRIDGELINE_WALLET_PRIVATE_KEY
HEDERA_UNAPPROVED_BUYER_WALLET_PRIVATE_KEY
HEDERA_MOCK_USDC_TOKEN_ADDRESS
HEDERA_TESTNET_RPC_URL
SEPOLIA_PLATFORM_WALLET_PRIVATE_KEY
SEPOLIA_RPC_URL
RESEND_API_KEY
```

Plus the two gitignored files, as single-line JSON (`jq -c . libs/privy/accounts.json`):

```
PRIVY_ACCOUNTS_JSON   = contents of libs/privy/accounts.json
PRIVY_KEYS_JSON       = contents of libs/privy/keys.json
```

And on **investor** only, the business service's public URL, so its Reset button reaches it:

```
NEXT_PUBLIC_BUSINESS_PORTAL_URL = https://<business-domain>
```

`NEXT_PUBLIC_*` values are inlined at build time; Railway passes service variables into the
Docker build, so changing one means redeploying.

## Privy

Sign-in worked on the Railway domains without adding them to Privy's allowed origins — the
app has none configured, which means every origin is allowed. Add the two domains there if you
ever restrict it.

## After the first deploy

- Open `https://<business-domain>/invoices/outstanding` and press **Reset demo** once.
- Top up the wallets if needed: `npm run fund:accounts -w @rf/contracts-hedera-ats` (from a machine with the operator key).

## What the image does

- Installs the whole workspace and builds one portal (`npm run build -w @rf/<APP>`).
- On boot, `docker/entrypoint.sh` writes `accounts.json` / `keys.json` from the two variables, then runs `next start`.
- State files go to `DEMO_STATE_DIR=/data` (the volume); everything else is read from the chains.

## Local check

```
docker build -f docker/Dockerfile --build-arg APP=business --build-arg NEXT_PUBLIC_PRIVY_APP_ID=... -t rf-business .
docker run -p 3300:3000 --env-file .env.local -e PRIVY_ACCOUNTS_JSON="$(cat libs/privy/accounts.json)" -e PRIVY_KEYS_JSON="$(cat libs/privy/keys.json)" rf-business
```
