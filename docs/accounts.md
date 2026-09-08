# Who signs in, and what each account refuses

Four people sign in across two portals, and between them they demonstrate two different Privy
controls refusing two different things. This is the whole cast and the whole claim, in one page.

## The cast

| Side | Who signs in | How many | What their account is |
|---|---|---|---|
| **Business** — Ironline Freight | Anna Reed, Tom Hill, Grace Ward | **3 people** | **One** company account, owned by all three together |
| **Investor** — Woodgrove Capital | one portfolio manager | **1 person** | **One** fund account, owned by a server key, not by them |

Two accounts in total. The three directors hold **no account of their own** — each holds a key that
approves what the one company account does. That is what makes "two of three" a rule about the
company rather than a tally the portal keeps.

## The two controls, on purpose different

| | Ironline Freight | Woodgrove Capital |
|---|---|---|
| Privy control | **Key quorum** — three users, threshold 2 | **Policy** with a **condition set** |
| The rule | Two of the three must approve before the account acts | Never above $100,000; never into an invoice off the rated list |
| Who decides | Three people, at whatever hour each of them gets to it | Nobody — the account will not sign at all |
| The refusal | "Not enough approvals" | "Over the mandate" |

The asymmetry is deliberate. A quorum on one account and a policy on the other shows both halves of
Privy's control surface, rather than the same control twice. Giving the fund a quorum too would bury
the mandate refusal underneath an approval flow, and would misdescribe how a fund actually works — a
fund's constraint is the mandate it agreed with its investors, not a colleague signing off.

## What you can do on screen

### Business portal — Approvals

1. Sign in as `business-anna@…`. The panel names the invoice and the amount, and reads **0 of 2**.
2. Press **Approve**. Anna signs the sale in her own browser and the panel reads **1 of 2**.
3. Press **Send to the company account** now. **Privy refuses** — one approval is not two, and the
   refusal comes from the account, not from the portal. *(Refusal one.)*
4. Sign in as `business-tom@…` and press **Approve**. The panel reads **2 of 2**.
5. Press **Send** again. The same request, now carrying two signatures, goes through.

Step 3 is the point. The portal offers that button deliberately so the refusal can be produced on
demand, and it never checks the count itself — asking on too few approvals and being told no is the
demonstration.

### Investor portal — Compliance

1. Press **Allocate $47,500**. Within the cap, on the rated list — signed and sent.
2. Press **Allocate $150,000 — over the cap**. **Will not sign.** *(Refusal two.)*
3. Press **Allocate into an unrated invoice**. Will not sign — the rating floor is membership of a
   list the platform maintains, so an unrated invoice is refused by not being on it.

Nobody is asked in any of these. There is no approver to appeal to, which is the difference between
a mandate and a policy someone can be talked out of.

## What makes the refusals worth anything

- Both accounts are funded far above every amount attempted, so no refusal can be explained away as
  an empty account. Every refusal shown on screen names the rule.
- Both refusals come back from Privy and are displayed unchanged. A message we wrote would read the
  same whether or not anything had actually refused.
- Rating a new invoice means adding it to the list. The fund's rule is never rewritten to admit it.

## Setting it up

1. Fill `libs/privy/.env` from `libs/privy/.env.example` — four credentials and three email addresses.
2. Fill `apps/business/.env.local` and `apps/investor/.env.local` from their `.env.example` — the
   same Privy app id in both.
3. `npm run provision -w @rf/privy` — creates the three directors, the two-of-three group, both
   accounts, the rated list and the mandate, then writes `libs/privy/accounts.json`. Running it again
   creates nothing.
4. `npm run build -w @rf/business && npm run start -w @rf/business -- --port 3200`, and the same for
   `@rf/investor` on 3201.

The three directors' addresses must be able to receive mail: Privy sends each of them a sign-in code.

## Checking it without doing it by hand

```
cd libs/privy && npx vitest run      # the rules, the request bytes, the approval count
cd apps/e2e && npx playwright test   # both refusals, in a browser, against both portals
```
