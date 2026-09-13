# tools/proof — the Receivables Flow capital cycle

One journey: the money going round once. Capital leaves a fund, reaches a business, and comes
back having made that business's next loan cheaper.

This board held two journeys until 2026-09-11 — Ironline's and Woodgrove's. That is the right
shape for designing a product and the wrong shape for demonstrating one: a four-minute video
cannot be two app tours. Business, fund and staff are all still here, as actors inside one
cycle rather than as journeys of their own, which is why every step's action names who acts.

## Run it

```bash
npm install
npm run dev      # http://localhost:6322 → redirects to /proof/capital-flywheel
```

`predev` reseeds the database and regenerates `public/journey.json` before Vite starts, so
`npm run dev` always serves what the seed file currently says.

## How the data gets here

The journey is hand-authored TypeScript, not extracted:

```
src/engine/seed/capital-flywheel.seed.ts ──► journey.db (SQLite) ──► public/journey.json ──► the board
```

| Command | What it does |
|---|---|
| `npm run seed` | Wipes and rewrites the journey, then re-exports `journey.json` |
| `npm run db:export` | Re-exports `journey.json` from the database without reseeding |
| `npm run db:reset` | Deletes `journey.db` and reapplies the schema |
| `npm run typecheck` | `tsc --noEmit` |

Re-running the seed is idempotent — counts stay the same, they don't double. Slugs are not
stored: `db/export.ts` derives them from each row's own name at export time and dedupes them
within their parent, so a URL can never drift from what's displayed.

## What you see

Three rows, one column per goal.

| Row | Holds |
|---|---|
| Phase | The stage of the cycle |
| Goal | What this part of the cycle achieves, in the words of whoever is acting |
| Steps (How) | One card per step, badged with the sponsor whose technology does the work |

Every column that was about how the work gets done is gone — Why This Stack, Requirement Met,
Extra Points, Why We Win, and the E2E Test row that briefly replaced them. This board answers
what happens and to whom, in order. Whether a step is real yet is on the step itself, as its
status; where the proof lives is a question for the repository, not for the map.

Milestone and goal say the same thing here — one goal per milestone, deliberately — so the
board renders the pair once, labelled Goal. Both rows still exist in the database, since every
step hangs off a goal, and the sidebar tree and URL paths are built from them.

`apps/e2e` is laid out to match, one directory per phase and one spec per goal:

```
apps/e2e/src/u1-capital-cycle/p3-deploy-capital-and-exit-early/g1-fund-the-invoice-in-one-transaction.spec.ts
```

A step nothing asserts yet is named in its goal spec's own header comment rather than left
out, so a phase can never look covered because the gap went unwritten.

## The cycle

Twenty steps across four phases, timed against a four-minute demo.

| Phase | What happens | Minutes |
|---|---|---|
| Sign In Both Sides | Both sides sign in — two tabs — and the platform approves them | 0:00–0:35 |
| Source And Underwrite The Invoice | An invoice is submitted, two of three directors approve it, and the public record prices it | 0:35–1:35 |
| Deploy Capital And Exit Early | It is funded in one transaction, three purchases are refused, and half is sold on day 20 | 1:35–3:00 |
| Collect Repayment And Reprice Capital Cost | Day 60 is repaid or defaulted, written onto the record, and the next invoice reprices | 3:00–4:00 |

The last step of the last phase changes the price the second phase quotes. That is the
flywheel, and it is why the journey's cadence is `repeating` rather than `one_time`.

## Step text

Step text names no technology. "Two directors approve the sale from their phones, hours
apart" is what the user does; the word *quorum* appears nowhere on a step card. The
mechanism lives in the sponsor badge and in the test named beneath it.
