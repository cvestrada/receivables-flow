# Test Plan · Check the investor's KYC status at the moment of purchase

**Level:** 13 `[integration]` + 1 `[e2e]`. No `[unit]`: the only logic here lives in Solidity, so even the expiry comparison needs a node. The `[e2e]` is the one thing the local suite cannot prove — that the record staff wrote on Sepolia is the number the token enforces on Hedera.

**Layer:** Contracts

**File:** `contracts/hedera-ats/test/ens-kyc-list.spec.ts` · `[e2e]` is `contracts/hedera-ats/scripts/mirror-kyc.ts`

**Run:** `npm -w @rf/contracts-hedera-ats test` · `[e2e]`: `npm -w @rf/contracts-hedera-ats run mirror:kyc`

The suite deploys the full ATS system onto Hardhat's in-memory network once per file, then issues a fresh token with its own `EnsKycList` attached per test. No testnet, no funded account, no key.

---

## Overview

| # | Test | Category | Spec item |
|---|---|---|---|
| 1 | A wallet published with a future expiry is GRANTED | Integration | Action Item 1 · `getKycStatus` |
| 2 | A wallet is refused at the exact second it expires | Integration | Business rule · strictly ahead, never at the expiry itself |
| 3 | A wallet nobody published is refused | Integration | Business rule · absence is refusal |
| 4 | A wallet withdrawn before its expiry is refused | Integration | Business rule · a rejection takes effect on the next call |
| 5 | Publishing records the ENS name the approval came from | Integration | Business rule · the name is stored alongside |
| 6 | Publishing the same wallet and expiry twice changes nothing | Integration | Business rule · publishing is idempotent |
| 7 | A caller who is not the publisher cannot publish | Integration | Business rule · only the publisher may write |
| 8 | A caller who is not the publisher cannot withdraw | Integration | Business rule · only the publisher may write |
| 9 | An approved investor buys from an approved business | Integration | Action Item 2 · the list is attached at creation |
| 10 | An investor whose KYC was rejected is refused | Integration | Action Item 3 · the buyer-side refusal |
| 11 | An investor whose approval has lapsed is refused | Integration | Business rule · lapses with no call from us |
| 12 | An investor nobody published is refused | Integration | Business rule · absence is refusal |
| 13 | A business whose KYC was rejected cannot sell | Integration | Business rule · ATS validates both sides |
| 14 | The expiry on Hedera is the one on the live ENS name | E2E | Action Item 4 · the two-chain path |

Tests 9–13 drive a real sale through `ReceivableDvp` rather than a direct transfer, so the refusal proved is the one a buyer would actually hit.

---

## Tests

**EnsKycList**

- **getKycStatus**
  - [integration] [happy-path] a wallet published with an expiry still ahead of the chain's clock is reported KYC approved
  - [integration] [boundary] a wallet is reported not approved at the exact second its approval expires, not one second later
  - [integration] [unhappy-path] a wallet nobody ever published is reported not approved
  - [integration] [unhappy-path] a wallet withdrawn before its expiry is reported not approved from then on

- **publish**
  - [integration] [happy-path] the ENS name an approval came from is recorded beside the wallet, so a reader can see who granted it
  - [integration] [boundary] publishing the same wallet and the same expiry a second time leaves the answer unchanged
  - [integration] [unhappy-path] an account that is not the publisher cannot approve anyone

- **withdraw**
  - [integration] [unhappy-path] an account that is not the publisher cannot take an approval back

**Receivable sale with the list attached**

- **settle**
  - [integration] [happy-path] an investor whose KYC is approved buys the receivable from a business whose KYC is approved, and both the money and the units move
  - [integration] [unhappy-path] an investor whose KYC was rejected is refused by the token itself, and neither the money nor the units move
  - [integration] [unhappy-path] an investor whose approval has run out is refused, with nobody at Receivables Flow having done anything in between
  - [integration] [unhappy-path] an investor nobody published is refused
  - [integration] [unhappy-path] a business whose KYC was rejected cannot sell the receivable it owns

**mirror-kyc, against live Sepolia and Hedera testnet**

- **mirrorKyc**
  - [e2e] [happy-path] the expiry the script publishes on Hedera is the one the live ENS name actually carries on Sepolia, for both the business and the investor, and the run prints a HashScan link for each

---

## Notes

- The layer reference places contract tests at `contracts/test/<ContractName>.test.ts`. This file follows the approved spec's `contracts/hedera-ats/test/ens-kyc-list.spec.ts` instead, matching the two suites already in this package.
- Tests 10–13 assert both the revert and unchanged balances on both legs. A refusal that silently no-opped, or one that took the payment and not the units, would pass a revert-only assertion.
- Test 11 advances the chain's clock past the expiry and calls nothing else, which is what proves the lapse needs no transaction from us.
- Test 2 pins the boundary at the expiry second itself, because "approved until" and "approved through" differ by one second and only one of them matches the ENS record.
- Test 13 is the one that would be missed by reading the issue title alone: ATS validates the sender as well as the recipient, so an unapproved business is refused on its own sale.
- Test 14 is a script rather than a Playwright spec, because `apps/e2e` drives a browser and this path has no UI. It is the only check that would catch the two chains disagreeing — a local suite publishes whatever number it invented, so it can never fail that way. It needs the funded accounts from TECH-580, which is Done, and the addresses already in both `deployed.json` files.
