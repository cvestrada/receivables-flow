# Test Plan — Open both accounts and make the two refusals happen in the browser

**Layer:** Integration libs
**Files:** `libs/privy/test/policies.test.ts` (unit) · `libs/privy/test/approvals.test.ts` (unit) ·
`libs/privy/test/refusals.test.ts` (integration)
**Runner:** `npx vitest run` from `libs/privy`

Three groups, because three different things can be wrong.

**What we describe.** Two directors approve by signing, and a signature only counts if both signed
the identical thing. If the portal describes the same sale two different ways, the provider sees two
approvals of two different sales and refuses — and the bug looks exactly like the quorum working.

**What we count.** Between the first approval and the second, the count lives with us. Counting to
two wrongly does not sell an invoice — the provider still refuses — but it does put a portal on
screen that lies about where the sale stands.

**What the provider refuses.** The whole claim of this issue. Needs live accounts, because the point
is that Privy refuses rather than our code.

## Overview

| # | Category | Tag | Behaviour | Spec source |
|---|---|---|---|---|
| 1 | [unit] | [happy-path] | Two directors approving one sale sign byte-identical requests | Business rule — the same sale, down to the byte |
| 2 | [unit] | [boundary] | A sale of a different invoice is a different request | Business rule — two approvals of two sales are not two of one |
| 3 | [unit] | [happy-path] | An allocation carries the stated dollars at the published rate | Business rule — the scale |
| 4 | [unit] | [happy-path] | The first approval leaves the sale at 1 of 2 | Business diagram — "one" branch |
| 5 | [unit] | [boundary] | One director approving twice is still one approval | Business rule — one approval never moves anything |
| 6 | [unit] | [happy-path] | The second approval brings the sale to 2 of 2 | Business diagram — "two" branch |
| 7 | [integration] | [unhappy-path] | A sale sent with one approval is refused by the provider | Business diagram — "Sell early" branch |
| 8 | [integration] | [happy-path] | The same sale sent with two approvals goes through | Business diagram — "the sale goes through" |
| 9 | [integration] | [unhappy-path] | A $150,000 allocation will not sign — over mandate | Investor diagram — "no" on the amount |
| 10 | [integration] | [unhappy-path] | An allocation into an unlisted invoice will not sign | Investor diagram — "no" on the rating |
| 11 | [integration] | [happy-path] | A $47,500 allocation into a listed invoice is signed and sent | Investor diagram — both "yes" branches |
| 12 | [integration] | [boundary] | Opening the accounts a second time creates nothing | Business rule — idempotent provisioning |

---

## **What we describe** — `policies.test.ts`

### **buildSaleRequest**

**[unit] [happy-path] two directors approving one sale sign byte-identical requests**
Building the request for the same invoice and the same buyer twice produces the same bytes both
times. This is the load-bearing test of the lane: if it drifts — a timestamp, a nonce, a key order —
the two directors sign two different things, the provider counts one approval of each, and the sale
is refused for a reason that looks identical to the quorum doing its job.

**[unit] [boundary] a sale of a different invoice is a different request**
Changing the invoice changes the bytes. Guards the opposite failure: a request so generic that
approving one sale silently approves another.

### **buildAllocationRequest**

**[unit] [happy-path] an allocation carries the stated dollars at the published rate**
A $47,500 allocation carries the chain amount that $47,500 converts to, and names the invoice being
bought as the recipient. The fund's rule compares against exactly this field, so a conversion error
here is refused as over-mandate and reads as a working control.

---

## **What we count** — `approvals.test.ts`

### **The approval record**

**[unit] [happy-path] the first approval leaves the sale at 1 of 2**
Recording one director's approval reports one of the two required, and yields nothing to send. The
portal shows 1 of 2 because one person approved, not because a counter was incremented.

**[unit] [boundary] one director approving twice is still one approval**
The same director approving the same sale a second time replaces their approval rather than adding
to it. Without this, one person reaches two of two alone — the exact failure the account exists to
prevent, displayed as success.

**[unit] [happy-path] the second approval brings the sale to 2 of 2**
A second, different director's approval reports two of two and yields both approvals in the order
they arrived, ready to send.

---

## **What the provider refuses** — `refusals.test.ts`

Requires live Privy credentials and both accounts open. Each refusal is asserted to name the rule
that refused, never a shortfall of funds — both accounts are funded far above every amount attempted
so that the two cannot be confused.

**[integration] [unhappy-path] a sale sent with one approval is refused by the provider**
Sending the sale carrying one director's approval is refused, and the refusal comes from Privy. This
is the first of the two refusals the issue exists to produce.

**[integration] [happy-path] the same sale sent with two approvals goes through**
The identical request, carrying a second director's approval, is accepted and returns a transaction.
Same bytes, different outcome — which is what proves the first refusal was the threshold and not a
malformed request.

**[integration] [unhappy-path] a $150,000 allocation will not sign — over mandate**
The fund's account refuses to sign an allocation above its cap, naming the mandate. The second of the
two refusals.

**[integration] [unhappy-path] an allocation into an unlisted invoice will not sign**
An allocation into an invoice absent from the platform's rated list is refused. Rating an invoice is
adding it to the list, so this is the rating floor being enforced without the fund's rule mentioning
a rating.

**[integration] [happy-path] a $47,500 allocation into a listed invoice is signed and sent**
Within the cap and on the list, the allocation goes through. Without this the two refusals above
prove only that the account refuses everything.

**[integration] [boundary] opening the accounts a second time creates nothing**
Running provisioning again returns the same account addresses, the same quorum and the same policy,
and reports nothing created.

---

## Not covered here

**The two buttons on screen.** That both refusals reach the browser is checked by hand against the
running portals, per the spec's `next build` verify clauses. An automated browser test of a flow
whose whole point is a live provider refusing would test the mock, not the refusal.

**Blocked.** `refusals.test.ts` and the provisioning check cannot run until `libs/privy/.env` carries
a Privy app id, app secret, an authorization key, and the three directors' Privy user IDs. The unit
groups above run today with no credentials.
