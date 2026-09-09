# Test Plan · Make the business credit score a public formula anyone can recompute

**Layer:** Contracts package (`@rf/contracts-ens`) — Hardhat + chai

**Files:**
- `contracts/ens/test/unit/score.test.ts` (new)
- `contracts/ens/test/integration/registry.test.ts` (edited)
- `apps/e2e/tests/score.spec.ts` (new)

**Run:**
- `cd contracts/ens && npm run test:unit`
- `cd contracts/ens && npm run test:int`
- `cd apps/e2e && ../../node_modules/.bin/playwright test score.spec.ts --trace on`

---

## Overview

| # | Spec item | Category | Test |
|---|---|---|---|
| 1 | Publish the score as a pure function of the three counts | [unit] | a business that repaid every matured invoice scores 100 |
| 2 | Publish the score as a pure function of the three counts | [unit] | a business that repaid four of five matured invoices scores 80 |
| 3 | Core Logic — score is stated out of 100, rounded | [unit] | two of three matured invoices repaid rounds to 67 |
| 4 | Core Logic — `financed` is never an input | [unit] | invoices still outstanding leave the score unchanged |
| 5 | Core Logic — same counts, same score, whoever computes it | [unit] | the same counts computed twice give an identical answer |
| 6 | Core Logic — no matured invoices means unrated | [unit] | a business with nothing matured yet is unrated |
| 7 | Core Logic — unrated is not a score of 0 | [unit] | a business that defaulted on everything scores 0, which is not unrated |
| 8 | Publish the score as a pure function of the three counts | [integration] | the score read back off a live page matches the counts written to it |
| 9 | Delete the stored rating and the reviewer who wrote it | [integration] | a business page carries no rating record for anyone to write |
| 10 | Delete the stored rating and the reviewer who wrote it | [integration] | a stranger cannot write the counts either |
| 11 | Put the number in front of the fund | [e2e] | the fund reads a credit score out of 100 on the offer itself |
| 12 | Prove it on screen, through the browser | [e2e] | no letter grade survives anywhere on the market screen |
| 13 | Put the number in front of the fund | [e2e] | the mandate floor the fund enforces is a number too |

---

## Tests

**creditScore** — the published formula

- **score**
  - [happy-path] a business that repaid every matured invoice scores 100
  - [happy-path] a business that repaid four of five matured invoices scores 80
  - [boundary] two of three matured invoices repaid rounds to 67
  - [boundary] invoices still outstanding leave the score unchanged
  - [boundary] the same counts computed twice give an identical answer
  - [boundary] a business with nothing matured yet is unrated
  - [unhappy-path] a business that defaulted on everything scores 0, which is not unrated

**registry** — a business page on Sepolia

- **readScore**
  - [happy-path] the score read back off a live page matches the counts written to it

- **rating record**
  - [unhappy-path] a business page carries no rating record for anyone to write
  - [unhappy-path] the business is refused writing the counts its own score is built from
  - [unhappy-path] a stranger is refused writing the counts too

**investor portal** — what the fund sees, driven through the browser

- **the offer**
  - [happy-path] the fund reads a credit score out of 100 on the offer itself
  - [happy-path] the mandate floor the fund enforces is a number too
  - [unhappy-path] no letter grade survives anywhere on the market screen
