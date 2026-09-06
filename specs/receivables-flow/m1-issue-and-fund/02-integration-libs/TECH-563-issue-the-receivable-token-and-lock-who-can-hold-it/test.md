# Test Plan · Issue the receivable token and lock who can hold it

**Level:** `[integration]` — all 5 tests. No `[unit]` (nothing here is a pure function). No `[e2e]` (blocked on TECH-580).

**Layer:** Contracts

**File:** `contracts/hedera-ats/test/receivable-token.spec.ts`

**Run:** `npm -w @rf/contracts-hedera-ats test`

The suite deploys the full ATS system (108 facets) onto Hardhat's in-memory network once per file, then issues a fresh invoice token per test. No testnet, no funded account, no key. Verified working by spike before this plan was written.

---

## Overview

| # | Test | Category | Spec item |
|---|---|---|---|
| 1 | Face value and maturity are recorded on the token | Integration | Action Item 2 · "Issue a token carrying the invoice's value and maturity" |
| 2 | An approved investor receives the token | Integration | Core Logic · approved branch |
| 3 | An investor who was never approved is refused | Integration | Action Item 3 · the refusal |
| 4 | An investor whose approval was withdrawn is refused | Integration | Business rule · removal takes effect immediately |
| 5 | A caller without the compliance role cannot approve | Integration | Business rule · only `ROLE_CONTROL_LIST` may change the list |

Every test is Integration: each one needs a real ATS deployment on a local Hardhat node. There is no pure-function logic in this issue to unit test, and the E2E run against Hedera testnet is blocked on TECH-580.

---

## Tests

**ReceivableToken**

- **issueReceivableToken**
  - [integration] [happy-path] an invoice issued for $50,000 payable in 60 days carries that value and that maturity date on the token itself, read back rather than remembered

- **transfer**
  - [integration] [happy-path] an investor Receivables Flow has approved receives the tokens, and the balance moves
  - [integration] [unhappy-path] an investor who was never approved is refused, the transaction fails, and no balance moves
  - [integration] [unhappy-path] an investor who was approved and then removed is refused, without the token being reissued

- **approveHolder**
  - [integration] [unhappy-path] an account that does not hold the compliance role cannot add anyone to the approved list

---

## Notes

- The layer reference places contract tests at `contracts/test/<ContractName>.test.ts`. This issue follows the approved spec's `contracts/hedera-ats/test/receivable-token.spec.ts` instead — the package owns its own Hardhat project, and there is no contract of ours to name the file after.
- Test 4 asserts the negative directly after a positive transfer to the same address, so the removal is what changed the outcome and not the starting state.
- Test 3 and test 4 assert both the revert and an unchanged balance. A refusal that silently no-ops would pass a revert-only assertion.
