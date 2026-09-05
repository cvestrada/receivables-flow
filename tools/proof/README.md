# tools/proof — Receivables Flow User Journeys

A journey map of both sides of the product: what **Ironline Freight** (the business) does, and what
the **Woodgrove Capital** does, step by step.

Modelled on Orbbit's own `tools/proof` (`/home/orbbit/orbbit/tools/proof`) — same board, same
sidebar, same seed → SQLite → JSON pipeline.

## Run it

```bash
npm install
npm run dev      # http://localhost:6322 → redirects to /proof/business
```

`predev` reseeds the database and regenerates `public/journey.json` before Vite starts, so
`npm run dev` always serves what the seed files currently say.

## How the data gets here

Same shape as Orbbit's tool. Journeys are hand-authored TypeScript, not extracted:

```
src/engine/seed/business.seed.ts  ─┐
src/engine/seed/investor.seed.ts  ─┴─► journey.db (SQLite) ──► public/journey.json ──► the board
```

| Command | What it does |
|---|---|
| `npm run seed:business` | Wipes and rewrites Ironline Freight's rows, then re-exports `journey.json` |
| `npm run seed:investor` | Same for the investor |
| `npm run db:export` | Re-exports `journey.json` from the database without reseeding |
| `npm run db:reset` | Deletes `journey.db` and reapplies the schema |
| `npm run typecheck` | `tsc --noEmit` |

Each seed run wipes only its own actor's rows before reinserting, so editing one side never
disturbs the other, and a deleted step actually disappears instead of lingering next to its
replacement. Re-running a seed is idempotent — counts stay the same, they don't double.

Slugs are not stored. `db/export.ts` derives them from each row's own name at export time and
dedupes them within their parent, so a URL can never drift from what's displayed.

## What you see

Seven rows per journey, one column per goal. The row labels are column 1 of the same CSS grid
as the content and are pinned with `position: sticky`, so a label can never drift out of line
with its own row — two grids sharing a `gridTemplateRows` string do drift, because
`max-content` is resolved separately in each one.

| Row | Holds |
|---|---|
| Phase | The stage of the journey |
| What They Can Do | What the business or the fund gets out of this, in their own words |
| Steps (How) | One card per step, badged with the sponsor whose technology does the work |
| Why This Stack | Why that technology and not a row in our own database |
| Requirement Met | The qualification bar this clears, close to the track's own wording |
| Extra Points | The listed bonus item, where one is genuinely hit |
| Why We Win | The demo moment, or the thing most teams will not have |

Milestone and goal say the same thing here, so the board renders it once. The milestone rows
still exist in the database — the sidebar tree and the URL paths are built from them.

## The two journeys

One journey per side, 19 steps. Set Up runs once per business rather than once per invoice,
but it stays inside the business journey anyway — a judge should see one unbroken line from
"this company has no wallet" to "the holders were paid."

**Business — Ironline Freight · Issue And Settle A Receivable** (10 steps)

| Phase | What they can do | Sponsors |
|---|---|---|
| Set Up | Open a company account and decide which employees can approve what | Privy |
| Set Up | Get a public business profile with a rating buyers can check | ENSv2 |
| Issue | Sell an unpaid invoice and get the cash today instead of in 60 days | Privy, Hedera ATS |
| Issue | Know the payout will happen on the due date without chasing anyone | Hedera |
| Settle | Build a track record that makes the next invoice cheaper to sell | Hedera ATS, ENSv2 |

**Investor — Woodgrove Capital · Fund And Exit A Receivable** (9 steps)

| Phase | What they can do | Sponsors |
|---|---|---|
| Get Cleared | Get approved to invest and set the fund's own limits on what it can buy | Privy, ENSv2, Hedera ATS |
| Fund | Buy an unpaid invoice at a discount | Hedera ATS, Hedera |
| Exit | Sell part of it early instead of waiting for the due date | Hedera ATS |
| Exit | Get paid when the invoice is settled | Hedera ATS |

Each step is badged with exactly one sponsor — where a step leaned on two, it is two steps.
Across both journeys: **Hedera ATS 8, Privy 5, ENSv2 4, Hedera (non-ATS) 2.**

Step text names no technology at all. "Decides who can sell an invoice: the office manager up
to $10,000, two directors above that" is what the user does; the word *quorum* appears nowhere
on a step card. The mechanism lives in Why This Stack, and only as far as saying what it lets
the user do.

## What each step is for

Every step maps to a qualification requirement or a listed extra-points item.

### Hedera — Tokenization of Anything ($6,000)

| Requirement | Step that clears it |
|---|---|
| Use ATS to issue or manage a tokenised asset | `business-step-ats-issue` — ERC-3643 issuance, $50,000 face, 60-day maturity |
| Demonstrate on Hedera testnet | `business-step-ats-issue`, `investor-step-settle` |
| Video: issuance | `business-step-ats-issue` |
| Video: configuration | `business-step-ats-compliance` — KYC grants and transfer restrictions |
| Video: a lifecycle operation | Three available — transfer (`investor-step-settle`), compliance check (`investor-step-transfer-check`), distribution (`investor-step-collect`) |
| *Extra:* secondary market ATS lacks today | `investor-step-list-secondary`, `investor-step-secondary-fill` |
| *Extra:* compliance controls | `business-step-ats-compliance`, `investor-step-kyc-grant`, `investor-step-transfer-check` |
| *Extra:* distributions | `business-step-redeem`, `investor-step-collect` |
| *Extra:* Scheduled Transactions for maturity settlement | `business-step-schedule-redemption` |

Cashflow tokenisation — "invoices, receivables… sold at a discount and settled on maturity" —
is listed verbatim as a suggested idea on this track.

Still outstanding, and not a journey step: contracts verified on HashScan (a hard qualification
requirement) and an oracle for pricing. Both are build tasks; do not let their absence from
this board hide them.

### Privy — Best B2B Financial Product ($2,500)

| Requirement | Step that clears it |
|---|---|
| Privy as a core part of the product | No invoice can be sold without the approval, on either side |
| At least one Privy wallet | `business-step-org-wallet`, `investor-step-wallet` |
| A business or organization use case | Ironline Freight acts as a company, not as one person's key |
| A functional B2B workflow | `business-step-quorum-approval` — an approval gating a treasury operation |
| At least one Privy control | `business-step-quorum-policy` (per-role limits on one wallet) and `investor-step-mandate-policy` (the fund's own limits) |

The two on-camera refusals live here: one signature cannot sell an invoice, and an allocation
over the fund's mandate will not sign at all.

### ENSv2 — Best Use of ENSv2 ($4,500)

| Requirement | Step that clears it |
|---|---|
| Built on ENSv2, Sepolia | `business-step-register-subname` — subname registry with a Permissioned Resolver |
| Central, not cosmetic | `investor-step-eligibility-subname` decides who may hold; `business-step-write-history` prices the next sale |
| Not hard-coded | Records are written at runtime by onboarding and by redemption, then read back |
| Hierarchical registry / Enhanced Access Control | `business-step-delegate-credit-tier` — a role that can edit one record and nothing else |

## Open question — who controls the profile

The ENS design has an unresolved contradiction, and it is written down here rather than left
for a judge to find.

Two claims currently sit next to each other:

- *the name belongs to Ironline Freight, so its record survives leaving this platform*
- *Ironline Freight can never raise its own rating*

Both cannot be true of one name. If Ironline really owns it, they can eventually strip the
reviewer's role, swap the resolver, and rewrite the rating. If we keep enough control to stop
that, they do not own it and we could revoke the name the day they leave. ENSv2 offers a dial
between parent-controlled and fully independent subnames; this design quietly wanted both ends
of it at once.

The likely resolution, not yet reflected in the seeds:

1. **Split the names.** Identity (`ironline.eth`) belongs to the business. The attestation
   about them (`ironline.receivables.eth`) belongs to whoever is vouching. A rating a company
   can edit is worth nothing, which is why credit scores live with the bureau and not in the
   subject's own filing cabinet. Portability improves rather than dies: a business accumulates
   attestations from several platforms and a new funder picks which attesters it trusts.
2. **Publish facts, not grades.** Nobody appointed us a credit bureau. "Six invoices, six
   repaid on time" is something we observed; "tier B" is an opinion another platform has no
   reason to weight above its own underwriting.
3. **Anchor it to chain.** Every redemption already happened publicly on Hedera, so the record
   should index those transactions rather than assert an outcome. Then nobody has to trust us,
   which is what makes ENS load-bearing rather than a nicer database.

## A limit worth stating out loud

The broker pays **Ironline Freight**, not the token holders. Nothing on-chain forces that
payment into the controlled wallet — the broker can be told to pay an ordinary bank account.
Real factoring closes this with a notice of assignment, which is paperwork, not code. The
repayment webhook that triggers redemption is likewise us asserting the broker paid.

That is the trust boundary of tokenising any real-world asset. Naming it reads better than a
demo that pretends it is not there.

## Every step is marked "proposed"

`status` means *backed by real code*. No code exists yet, so all 19 steps render as amber
dashed `PROPOSED` cards and every step reads "Not yet tested". That is accurate, not a
placeholder.

As things get built, change a step's `status` in its seed file to `partially_built` or
`built` and reseed. When real tests exist, add `testResults` entries pointing at real file
paths — the board shows a green `Passed` badge only when a reader can go open the test.

## What Orbbit's version has that this one does not

Orbbit's `tools/proof` proves that *real code* matches stated journeys: a ts-morph extraction
engine walks the monorepo, resolves each capability to actual controllers, services and
repositories, and renders architecture and logic diagrams from what it finds.

None of that came across, because there is no codebase here to walk yet. The `capability`,
`node`, `edge` and `test_result` tables still exist and are still exported (the board reads
them for its drill-in), but they are empty. When this project has real code, that extractor
is the piece to port next.

## Layout

```
src/app/            the board and sidebar (JourneyBoard, ProofSidebar)
src/engine/db/      connection, schema, kysely types, JSON export
src/engine/seed/    one file per actor, plus the shared seed contract
src/ui/             vendored shadcn Sidebar — this repo has no @orbbit/fe-platform-ui
public/journey.json generated, committed so the board runs without a seed step
journey.db          generated, gitignored
```
