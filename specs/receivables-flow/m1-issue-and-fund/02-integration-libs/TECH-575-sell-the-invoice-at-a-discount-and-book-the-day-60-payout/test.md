# Test Plan · Sell the invoice at a discount and book the day-60 payout

**Layer:** Contracts (Solidity / Hardhat), plus pure pricing logic run by the same runner

**Files:**
- `contracts/hedera-ats/test/pricing.spec.ts`
- `contracts/hedera-ats/test/receivable-dvp.spec.ts` (extended)

**Run:** `cd contracts/hedera-ats && npx hardhat test`

> The pricing tests are `[unit]` — a pure function, no chain. They run under Hardhat's Mocha
> rather than vitest because that runner already exists in this package and the spec chose not
> to add a second one for one file.

---

## Overview

| # | Spec item | Category | Test |
|---|---|---|---|
| 1 | Price the invoice from its terms and the rating | [unit] | a `B`-rated $50,000 invoice at 60 days prices at exactly $47,500 |
| 2 | Price is derived from three published inputs and nothing else | [unit] | the same three inputs always produce the same price |
| 3 | A better rating never produces a larger discount | [unit] | improving the rating lowers the discount |
| 4 | A longer maturity never produces a smaller discount | [unit] | extending the maturity raises the discount |
| 5 | An unrated business is priced at the worst rating | [unit] | an empty rating is priced no better than the lowest grade |
| 6 | A year counts as 360 days | [unit] | a 360-day invoice is discounted by the full annual rate |
| 7 | Book the maturity payment inside the sale | [integration] | a settled sale leaves a booked schedule on the offer |
| 8 | The booking is refused → the whole sale reverts | [integration] | the buyer keeps their money and the seller keeps their units |
| 9 | Maturity is measured from when the sale settled | [integration] | the booked time is the settlement time plus the invoice's days |
| 10 | Only the schedule callback may mature a receivable | [integration] | an ordinary account is refused |
| 11 | A receivable matures once | [integration] | a second callback is refused |

---

## Tests

**price**

- **priceFor**
  - [happy-path] a `B`-rated $50,000 invoice at 60 days prices at exactly $47,500
  - [happy-path] the same face value, maturity and rating always produce the same price
  - [happy-path] a 360-day invoice is discounted by the full annual rate for its grade
  - [boundary] improving the rating from `B` to `AA` lowers the discount
  - [boundary] extending the maturity from 30 to 90 days raises the discount
  - [unhappy-path] a business with no rating published is priced no better than the lowest grade
  - [unhappy-path] a rating nobody recognises is priced no better than the lowest grade

**ReceivableDvp**

- **settle**
  - [happy-path] a settled sale leaves a booked schedule address on the offer
  - [happy-path] the booked maturity is the settlement time plus the invoice's days to maturity
  - [happy-path] the booking names the receivable it will mature, so the callback cannot land on another
  - [unhappy-path] the whole sale reverts when the network refuses the booking, leaving the buyer's money and the seller's units where they were

- **mature**
  - [happy-path] the schedule callback marks the receivable matured
  - [unhappy-path] an ordinary account calling it directly is refused
  - [unhappy-path] a second callback on an already matured receivable is refused
