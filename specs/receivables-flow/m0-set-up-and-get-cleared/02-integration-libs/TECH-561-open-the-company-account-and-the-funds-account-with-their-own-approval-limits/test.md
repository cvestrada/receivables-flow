# Test Plan — Open the company account and the fund's account with their own approval limits

**Layer:** Integration libs
**Files:** `libs/privy/test/policies.test.ts` (unit) · `libs/privy/test/refusals.test.ts` (integration)
**Runner:** `npx vitest run` from `libs/privy`

Two halves, because two different things can be wrong.

**Unit** tests the rules *we author* — the cap value, the comparison direction, the threshold, the
conversion. No credentials, no money, runs in CI on every commit. A rule that is wrong here is
enforced perfectly by the provider and still wrong.

**Integration** tests that the provider then *enforces* them. Needs live accounts, because the whole
claim is that Privy refuses rather than our code. Per the layer reference, "Privy org wallet +
approval flow" is integration.

## Overview

| # | Category | Tag | Behaviour | Spec source |
|---|---|---|---|---|
| 1 | [unit] | [happy-path] | The approving group requires two of three | Business rule — any two must approve |
| 2 | [unit] | [happy-path] | The fund's rule caps a purchase at $100,000 | Investor diagram — amount branch |
| 3 | [unit] | [happy-path] | The fund's rule demands membership of the rated list | Investor diagram — rating branch |
| 4 | [unit] | [boundary] | Anything not explicitly allowed is refused | Business rule — deny by default |
| 5 | [unit] | [boundary] | Dollars convert to chain amounts at one HBAR per $10,000 | Business rule — the scale |
| 6 | [integration] | [unhappy-path] | One approval alone does not sell the invoice | Business diagram — "no, only one" branch |
| 7 | [integration] | [happy-path] | The sale goes through once a second person approves | Business diagram — "yes" branch |
| 8 | [integration] | [happy-path] | A purchase within the mandate, of a rated invoice, goes through | Investor diagram — both "yes" branches |
| 9 | [integration] | [unhappy-path] | A purchase above $100,000 is refused as over mandate | Investor diagram — "no" on the amount |
| 10 | [integration] | [unhappy-path] | A purchase of an invoice absent from the rated list is refused | Investor diagram — "no" on the rating |

---

## **The rules we author** — `policies.test.ts`

### **The approving group**

**[unit] [happy-path] the approving group requires two of three**
The group we build names three members and requires two of them. Guards the single most consequential
number in the lane — a threshold of 1 would let one person sell an invoice and every integration test
would still pass.

### **The fund's rule**

**[unit] [happy-path] the fund's rule caps a purchase at $100,000**
The rule allows a purchase at or below the cap and denies one above it. Asserted on the built object,
including the direction of the comparison, because a reversed comparison refuses everything legitimate
and allows everything else.

**[unit] [happy-path] the fund's rule demands membership of the rated list**
The rule requires the invoice being bought to be on the platform's rated list, and names the list the
provisioning step actually creates.

**[unit] [boundary] anything not explicitly allowed is refused**
The rule carries no permission beyond the two above — no method is left open by omission.

### **Amounts**

**[unit] [boundary] dollars convert to chain amounts at one HBAR per $10,000**
$100,000 converts to ten HBAR in the chain's smallest unit. An error of one decimal place here makes
every cap wrong by a factor of ten while every other test still passes.

---

## **What the provider enforces** — `refusals.test.ts`

### Preconditions — asserted once before the suite, not as tests

- Both accounts exist in `libs/privy/accounts.json`.
- Both accounts hold more than any amount any test attempts. If this fails the suite aborts rather
  than running, because a refusal from an empty account would look identical to a refusal from a rule.

---

### **Ironline Freight's company account**

#### **offerInvoice / approveOffer**

**[integration] [unhappy-path] one approval alone does not sell the invoice**
An invoice is offered for sale and one of the three people approves it. Nothing settles — the sale is
still waiting, and no transaction exists on chain. Asserted to be an unmet approval threshold, not a
failure or a rejection.

**[integration] [happy-path] the sale goes through once a second person approves**
Starting from the state above, a second of the three approves. The sale then settles on its own and a
transaction hash exists. The two approvals are submitted as separate calls, so the test also shows the
first approval surviving until the second arrives.

---

### **Woodgrove Capital's fund account**

#### **buyInvoice**

**[integration] [happy-path] a purchase within the mandate, of a rated invoice, goes through**
The fund buys a $50,000 invoice that is on the platform's rated list. It is under the $100,000 cap and
on the list, so the purchase settles and a transaction hash exists.

**[integration] [unhappy-path] a purchase above $100,000 is refused as over mandate**
The fund attempts a $150,000 purchase of an invoice that is on the rated list, so the only rule broken
is the amount. Privy refuses to sign. Asserted to be a policy refusal — not insufficient funds, and
not an error from our own code.

**[integration] [unhappy-path] a purchase of an invoice absent from the rated list is refused**
The fund attempts a $50,000 purchase — comfortably under the cap — of an invoice that is not on the
rated list, so the only rule broken is the rating. Privy refuses to sign. Asserted to be a policy
refusal rather than insufficient funds.
