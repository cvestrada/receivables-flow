# Test Plan — TECH-624

Most of this issue is composition — HQ reads the ENS package and calls it back. The logic worth
testing on its own is the one decision the page makes for itself: turning a chain answer into a
row that says approved or not. Everything else is proved in a browser, against Sepolia.

| Tier | Runs against | Command |
|---|---|---|
| Unit | pure functions, no network | `npm -w @rf/hq run test:unit` |
| Browser | the built page and live Sepolia | `npm -w @rf/hq run test:e2e` |

---

## Unit — `apps/hq/src/lib/ens/standing.test.ts`

The row a party turns into. No chain.

| # | Statement under test | Assertion |
|---|---|---|
| 1 | [happy-path] A party whose record stands and whose date is ahead reads as approved | the row's status is approved |
| 2 | [unhappy-path] A party whose record was withdrawn reads as not approved | an empty wallet gives a row that is not approved |
| 3 | [unhappy-path] A party whose date has passed reads as not approved | an expiry behind the moment asked about gives a row that is not approved |
| 4 | [boundary] A party with no name at all still produces a row | it appears in the list, not approved, with no date |
| 5 | [happy-path] The row carries the date staff need to see | the expiry is rendered as a plain day, not a timestamp |

---

## Browser — `apps/hq/e2e/standing.spec.ts`

Playwright boots the built page. Every press is a real transaction on Sepolia, so the suite
makes exactly two of them and puts the fund back the way it found it.

| # | Statement under test | Assertion |
|---|---|---|
| 6 | [happy-path] HQ opens showing every party and its current standing | the fund's row carries the name and wallet recorded in the deployment record |
| 7 | [happy-path] Rejecting flips the row | after Reject KYC the fund's row reads not approved |
| 8 | [happy-path] Approving flips it back | after Approve KYC the same row reads approved again |
| 9 | [happy-path] Each press reports what it changed | a transaction hash appears on the row after each decision |

---

## Not covered

The root `.env.example` action item has no logic — its verify clause runs the balance check
against the consolidated file, which is the acceptance test.
