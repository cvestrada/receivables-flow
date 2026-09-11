# Test Plan · Pay the day-60 repayment in mock USDC anyone can deposit

**Layer:** Contract (Solidity / Hardhat) + E2E (Playwright)

**Files:**
- `contracts/hedera-ats/test/mock-usdc.spec.ts`
- `apps/e2e/tests/repay.spec.ts` (extended)

**Run:**
- `npm test -w @rf/contracts-hedera-ats`
- `npm test -w @rf/e2e`

---

## Overview

| Action Item | Category | Test file |
|---|---|---|
| Issue a dollar anyone can deposit | [integration] | `contracts/hedera-ats/test/mock-usdc.spec.ts` |
| Deploy it and fund the repayment | [e2e] | none — the spec's Verify command is the check |
| Pay from it, and report only what landed | [e2e] | asserted on screen by the repay spec |
| Show each holder paid, and what paid it | [e2e] | `apps/e2e/tests/repay.spec.ts` |
| Say what the money is, in the README and the env | [e2e] | none — the spec's `grep` is the check |
| Prove it in a browser | [e2e] | `apps/e2e/tests/repay.spec.ts` |

The payment half of `repay.ts` is not unit tested. Every branch it has is a real transfer, a
real balance read or a real revert against Hedera testnet — a version with those mocked would
assert that our own mock returns what we told it to, which is exactly the failure this issue
exists to fix. It is proved on screen instead, by a browser test reading amounts that only exist
because a transfer confirmed.

---

## Tests

**MockUsdc**

- **decimals**
  - [happy-path] mock USDC is denominated the same way Circle’s USDC is, so no amount on screen changes because the money changed

- **deposit**
  - [happy-path] an account holding nothing can deposit itself the full face value of the receivable
  - [happy-path] a second account can deposit for itself without permission from the first — nobody owns the right to issue it
  - [boundary] depositing nothing leaves the balance where it was

- **transfer**
  - [happy-path] paying a holder leaves the payer short by exactly what the holder gained
  - [unhappy-path] a payer that does not hold enough cannot send it, and no balance moves

---

**Ironline Freight — day 60 paid in mock USDC**

- **the repay panel**
  - [happy-path] each holder's row shows an amount actually paid, and the amounts add up to the $50,000 owed
  - [happy-path] every paid row shows the transaction that paid it
  - [happy-path] the panel names the money as mock USDC this project deploys rather than Circle's USDC
  - [unhappy-path] when nothing could be transferred, no row claims to have been paid and the panel says why
