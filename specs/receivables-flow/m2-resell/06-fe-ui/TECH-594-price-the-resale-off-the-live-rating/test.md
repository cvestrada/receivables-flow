# Test Plan — Price the resale off the live rating

One test per testable statement in the spec's Business rules and Action Items. Derived after the
fact for this issue: the implementation was written before the spec was, and this plan records
which test actually holds each rule rather than proposing tests still to write.

---

## `contracts/ens/test/unit/score.test.ts` — the published formula

| Rule | Test |
|---|---|
| On-time payments count 100 | `scores a business that paid every matured invoice on time at 100` |
| A default counts 0 | `scores a business that paid four of five matured invoices, one missed, at 80` |
| The score rounds to a whole number | `rounds two on time and one missed of three matured to 67` |
| A late payment sits between paid and missed | `scores a late payment above a default and below an on-time one` |
| One late payment moves a spotless record to 93 | `drops a spotless business to 93 when one invoice is paid late` |
| A late payment is worth half an on-time one | `scores a business that paid everything, but always late, at 50` |
| `financed` is not an input | `leaves the score unchanged when invoices are still outstanding` |
| Two readers get the same number | `gives an identical answer to whoever computes it twice` |
| Nothing matured is unrated, not zero | `leaves a business with nothing matured yet unrated` |
| Zero is a real score | `scores a business that defaulted on everything at 0, which is not unrated` |

## `contracts/ens/test/integration/registry.test.ts` — what the profile publishes

| Rule | Test |
|---|---|
| The profile publishes four raw counts and no grade | `publishes raw counts and no combined score` |
| A stranger derives the score from the page | `derives the score a stranger reads from the counts on the page` |

## `apps/investor/src/lib/hedera-ats/resale-quote.test.ts` — the quote

| Rule | Test |
|---|---|
| The resale price is `priceFor` on the live score | `prices the resale off the score standing on the profile today` |
| Half the position, over the days remaining | `prices half the position over the days that are actually left, not the full tenor` |
| The day-0 rate is history and does not move | `holds the day-0 rate at what the sale actually happened at, whatever the record says now` |
| A worse record costs the business money | `makes a late payment cost the business money on the resale` |
| An unrated business is priced at the bottom | `quotes an unrated business at the bottom of the range rather than the top` |
| The screen must be able to say whether it read the chain | `carries through whether the score was read from the chain on this request` |

## `apps/e2e/tests/resale-price.spec.ts` — on screen

| Rule | Test |
|---|---|
| Both rates render together, with their terms | `the portfolio shows the day-0 rate and the day-20 rate side by side` |
| The price is quoted against a score, not chosen | `the day-20 price is quoted against the credit score, not against a number we chose` |
| A worse record produces a visibly worse price | `a record with one late payment on it visibly costs more` |
| The cost of the late payment is stated in dollars | `what the late payment costs is stated on screen as money` |
| The settled price is the quoted price | `the price the resale actually settles at is the price on the panel` |

## `apps/e2e/tests/pricing.spec.ts` — unchanged, and that is the point

The day-0 quote on Ironline's own screen still reads `100 / 100`, `30.00%` and `$47,500` after
the record was split three ways, because `splitPaid` reads the profile's legacy count as paid on
time. These four tests were not modified; they are the regression guard on the fallback.

---

## Not tested here

- Writing an on-time or late mark onto the profile — TECH-578 owns that, and nothing in this
  issue writes to ENS.
- Deriving on-time from a redemption's consensus timestamp — the comparison is stated in the
  spec's rules and belongs to the settlement lane that performs the redemption.
