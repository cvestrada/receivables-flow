# Test Plan — TECH-565

Same three tiers as TECH-562. Unit and integration run today with no funded account; the live
run is the onboarding script.

| Tier | Runs against | Needs funds | Command |
|---|---|---|---|
| Unit | pure functions, no network | no | `npm -w @rf/contracts-ens run test:unit` |
| Integration | a Sepolia **fork** — real ENSv2 contracts, fake funded accounts | no | `npm -w @rf/contracts-ens run test:int` |
| End-to-end | the onboarding script on a fork, then real Sepolia | fork no · live yes | `npm -w @rf/contracts-ens run onboard:fork` |

---

## Unit — `test/unit/encoding.test.ts`

The cleared-or-not decision, as a pure question about two dates. No chain.

| # | Statement under test | Assertion |
|---|---|---|
| 1 | [happy-path] A pass whose expiry is still ahead reads as cleared | asked a day before the expiry, the answer is cleared |
| 2 | [unhappy-path] A pass whose expiry has passed reads as not cleared | asked a day after the expiry, the answer is not cleared |
| 3 | [boundary] A pass asked for at the exact second it expires reads as not cleared | expiry and asking moment equal — not cleared |
| 4 | [unhappy-path] A fund that was never issued a pass reads as not cleared | an expiry of zero is not cleared at any moment |
| 5 | [happy-path] The answer carries the expiry it was decided on | the returned expiry is the one it was asked about, so a caller can show its working |

---

## Integration — `test/integration/registry.test.ts`

Hardhat forking Sepolia at a pinned block. The registry is the one TECH-562 opens, so the
investor pass is issued beneath the same platform name a business page is.

### Opening the two sides of the market

| # | Statement under test | Assertion |
|---|---|---|
| 6a | [happy-path] A fund's name says which side of the market it is on | the issued name is `woodgrove.investor.<base>.eth` |
| 6b | [happy-path] The investor side is a registry of its own | the platform registry's subregistry for `investor` is the branch registry |
| 6c | [boundary] Opening a side already open does not open a second one | a second call returns the same registry address |

### Issuing the pass

| # | Statement under test | Assertion |
|---|---|---|
| 6 | [happy-path] The fund gets a name beneath the platform's registry | `woodgrove.receivablesflow.eth` exists in the platform's own registry |
| 7 | [happy-path] The platform keeps ownership, the fund never gets it | the name's owner is the platform account, not the fund — so the fund cannot hand its clearance on |
| 8 | [happy-path] The name carries the expiry it was issued with | the expiry read from the registry matches the one passed at issue |
| 9 | [happy-path] The wallet the pass clears reads back as written | the recorded wallet is the fund's address, read back from chain |
| 10 | [boundary] Issuing the same pass twice does not issue a second name | a second call leaves the name, the wallet and the expiry unchanged |

### Reading the pass

| # | Statement under test | Assertion |
|---|---|---|
| 11 | [happy-path] A stranger holding only the name reaches cleared | reading with a plain provider and no platform involvement answers cleared |
| 12 | [unhappy-path] Once the chain clock passes the expiry, the pass reads as not cleared | after moving the fork past the expiry, the same read answers not cleared |

### Taking the pass back

| # | Statement under test | Assertion |
|---|---|---|
| 13 | [happy-path] The platform can take a standing pass back before its expiry | after revocation the same read answers not cleared, with the expiry still in the future |
| 14 | [unhappy-path] The fund cannot take back or re-issue its own pass | issuing or revoking from the fund's account reverts |

---

## End-to-end — the onboarding script

Asserted by printed output rather than a test runner, matching TECH-562.

| # | Statement under test | Assertion |
|---|---|---|
| 15 | The pass is issued during onboarding, not hard-coded | the script prints Woodgrove's wallet and expiry read back from chain |
| 16 | The same read answers both ways depending on when it is asked | the script prints `cleared` for today and `lapsed` for a date past the expiry |

---

## Browser — `apps/investor/e2e/pass.spec.ts`

Playwright boots the portal and drives it. The expected values are read from what onboarding
recorded on Sepolia, so the test fails if the screen and the chain disagree.

| # | Statement under test | Assertion |
|---|---|---|
| 17 | [happy-path] The fund's Compliance page shows the pass it holds on chain | the eligibility block carries the name, wallet and expiry recorded by onboarding |
| 18 | [happy-path] The status reflects the expiry rather than a written-down word | the block reads `Valid` while the expiry is ahead and `Lapsed` once it is not |
| 19 | [happy-path] The transfer log agrees with the pass above it | the row for Woodgrove quotes the same wallet and expiry the eligibility block does |
