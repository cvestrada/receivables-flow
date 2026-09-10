# Test Plan · Sell half the position early to another approved investor

**Layer:** FE unit (vitest) · Next.js API route · E2E (Playwright)

**Files:**
- `apps/investor/src/lib/hedera-ats/resale.test.ts`
- `apps/investor/src/app/api/resell/route.test.ts`
- `apps/investor/src/data/investor.data.test.ts`
- `apps/e2e/tests/resale.spec.ts`

**Run:**
- `npm run test:unit -w @rf/investor`
- `npm test -w @rf/e2e`

---

## Overview

| # | Spec item | Category | Test file |
|---|---|---|---|
| 1 | Read the two holders' balances off the chain | [unit] | `resale.test.ts` |
| 2 | Execute the resale and report what the chain said | [integration] | `route.test.ts` |
| 3 | Stop the day-20 story being hardcoded | [unit] | `investor.data.test.ts` |
| 4 | Put the Sell half action and the split on the fund's screen | [e2e] | `resale.spec.ts` |
| 5 | Prove it in a browser | [e2e] | `resale.spec.ts` |

---

## Tests

**Resale view**

- **resale**
  - [happy-path] both holders of the receivable are reported, with the seller listed first
  - [happy-path] each holder's share is its units as a proportion of the whole receivable
  - [happy-path] the two shares sum to the whole receivable — selling part creates no units and destroys none
  - [happy-path] the cash returned to the seller is the price the offer settled at
  - [boundary] a wallet holding no units is not reported as a holder
  - [boundary] a receivable still wholly owned by one fund reports a single holder at 100%
  - [unhappy-path] when the chain cannot be reached the known balances are reported and the view says it is not live

**Resell route**

- **POST /api/resell**
  - [happy-path] an approved buyer's purchase returns the transaction hash of the settled sale
  - [happy-path] the seller keeps the units it did not sell and is still a holder afterwards
  - [boundary] offering more units than the seller holds is refused before anything moves
  - [unhappy-path] an unapproved buyer is refused, and the chain's own reason is passed back untouched
  - [unhappy-path] a refused purchase moves no units and no money

**Day-20 portal data**

- **buildStages**
  - [happy-path] the day-20 held share is the share reported by the resale view, not a written-in figure
  - [happy-path] the day-20 cash returned is the figure reported by the resale view
  - [happy-path] the second buyer's row in the transfer log names the holder the view reports
  - [unhappy-path] when the view is not live the day-20 figures still render, marked as not live

**Investor portal — in a browser**

- **Sell half**
  - [happy-path] the portfolio section shows a Sell half action on the held position
  - [happy-path] clicking Sell half leaves two holders on screen, each with its share
  - [happy-path] the cash returned to the fund appears on screen after the sale
  - [unhappy-path] a purchase by a wallet with no eligibility pass is refused on screen, showing the chain's reason
