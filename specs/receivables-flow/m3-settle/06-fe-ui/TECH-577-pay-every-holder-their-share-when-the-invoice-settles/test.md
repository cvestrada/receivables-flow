# Test Plan · Pay every holder their share when the invoice settles

**Layer:** Contract (Hardhat) for the split · E2E (Playwright) for Ironline's screen

**Files:**
- `contracts/hedera-ats/test/distribution.spec.ts`
- `apps/e2e/tests/repay.spec.ts`

**Run:**
- `npm test -w @rf/contracts-hedera-ats`
- `npm test -w @rf/e2e`

---

## Tests

**distribution — what each holder is owed**

- **distribute**
  - [happy-path] two holders of half a $50,000 receivable each are owed $25,000
  - [happy-path] a holder of a quarter of the units is owed a quarter of the face value
  - [boundary] the amounts owed add up to the face value exactly, whatever the units divide into
  - [boundary] a remainder that will not divide evenly goes to the largest holder rather than being lost
  - [boundary] a wallet holding nothing is not owed anything and does not appear in the answer
  - [unhappy-path] a receivable nobody holds owes nobody anything, rather than dividing by zero

**Ironline Freight's portal — day 60**

- **repaying**
  - [happy-path] the receivables section states the $50,000 owed at maturity before anything is pressed
  - [happy-path] repaying shows both holders paid, each named with the units it holds
  - [happy-path] each amount paid is that holder's share of the $50,000, matching the share shown beside it
  - [happy-path] the amounts paid add up to the $50,000 owed
  - [boundary] repaying a second time reports the outcome already recorded rather than paying again

- **not repaying**
  - [unhappy-path] not repaying marks RCV-0001 defaulted on screen
  - [unhappy-path] each holder's loss is stated in the same proportion its payment would have been
  - [unhappy-path] no holder is shown as paid anything
