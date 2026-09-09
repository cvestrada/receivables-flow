# Test Plan · Make the business credit score a public formula anyone can recompute

**Layer:** Contracts package (`@rf/contracts-ens`) — Hardhat + chai

**Files:**
- `contracts/ens/test/unit/score.test.ts` (new)
- `contracts/ens/test/integration/registry.test.ts` (edited)

**Run:**
- `cd contracts/ens && npm run test:unit`
- `cd contracts/ens && npm run test:int`

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
| 10 | Delete the stored rating and the reviewer who wrote it | [integration] | nobody can be granted write access to a rating on a business page |

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
  - [unhappy-path] nobody can be granted write access to a rating on a business page
