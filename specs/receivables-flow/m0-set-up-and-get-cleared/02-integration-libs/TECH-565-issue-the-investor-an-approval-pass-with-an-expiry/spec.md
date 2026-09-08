# Issue the investor an approval pass with an expiry

## Overview

**What:**
Woodgrove Capital is given a public name of its own — `woodgrove.receivablesflow.eth` — that
says one thing: this fund is cleared to own invoices, until this date. Anyone can look the
name up and get the answer without asking Receivables Flow.

**Why:**
A tokenised invoice is a security, so only cleared investors are legally allowed to hold one,
and Receivables Flow is liable if one lands with a fund that is not. Today that permission
lives nowhere a buyer can check: the invoice can only change hands on this platform, with us
approving each side by hand. It also has to lapse — a fund's clearance is renewed on a date in
the real world, and a permission that never expires is quietly wrong from the day the fund
stops qualifying.

**How:**
The platform hands each cleared investor a name beneath its own, issued with an expiry and
kept in the platform's name so the investor cannot pass its clearance to someone else. Whoever
is on the other side of a trade reads that name and decides for themselves whether the fund
may receive the invoice.

**Zone 1 check:**
Advances **Deployment**. Moving an invoice to a buyer today means Receivables Flow vetting
that buyer by hand for every trade — unbounded verification, and only inside this platform.
Once clearance is a name with a date on it, the check is a public read anyone can run, and
the same read is what the invoice token itself consumes in TECH-566.

---

## Core Logic

```mermaid
flowchart TD

    SETUP["Platform already owns receivablesflow.eth and the registry beneath it — TECH-562"]

    subgraph ISSUE["Clearing Woodgrove Capital"]
        I1["Fund passes KYC off chain"]
        I2["Platform issues woodgrove.receivablesflow.eth with an expiry"]
        I3["Platform stays the owner of the name"]
        I4["The fund's wallet is recorded on the name"]
        I1 --> I2 --> I3 --> I4
    end

    SETUP --> ISSUE

    I4 --> READ["Anyone reads the name from a public node"]

    READ --> Q{"Is the expiry still in the future?"}
    Q -- "yes" --> CLEARED(["Cleared — may receive the invoice"])
    Q -- "no" --> LAPSED(["Not cleared — the pass lapsed on its own"])

    I3 --> NOPASS(["Woodgrove cannot hand the pass to another fund"])

    CLEARED --> REVOKE["Platform takes the pass back early"]
    REVOKE --> LAPSED

    CLEARED --> HEDERA["Invoice token reads this answer before a transfer — TECH-566"]
```

### Business rules

- The name is the pass. There is no separate cleared/not-cleared flag that could disagree with
  the name's own expiry.
- The expiry is set when the pass is issued, and a pass whose expiry has passed reads as not
  cleared without anyone acting.
- The platform owns the investor's name and never transfers it, so a cleared fund cannot pass
  its clearance to a fund that was never cleared.
- The wallet the pass clears is written at issue time and read back from chain; no address is
  hard-coded.
- The platform can take a standing pass back before its expiry, and doing so is a public event.
- A reader holding only the name and a public node can reach the answer — no call to
  Receivables Flow is part of the path.
- Running onboarding twice leaves the same name, the same wallet and the same expiry.

---

## File Tree

```
contracts/ens/
├── src/ens.ts                          # add: issue the pass, read it back, take it back early
├── scripts/onboard.ts                  # add: Woodgrove's pass, read back, and the lapse
├── test/unit/encoding.test.ts          # add: the cleared / lapsed decision, no chain
├── test/integration/registry.test.ts   # add: pass issued, read by a stranger, lapses on time
└── deployed.json                       # generated — now also the investor name and its expiry
```

---

## Action Items

**[x] Issue, read and take back an investor's pass**

Implement: In `contracts/ens/src/ens.ts`, add the investor-side registry operations, reusing
the platform registry TECH-562 opened.

- `issuePass` — give the investor a name beneath the platform's registry with an expiry,
  platform retained as owner, recording the wallet the pass clears; a second call for the same
  investor returns the standing pass rather than issuing a new one
- `readPass` — answer cleared or not for a name at a given moment, from a public node alone,
  returning the wallet and the expiry the answer was decided on
- `revokePass` — take a standing pass back before its expiry, so it reads as not cleared

Verify:
```
npm -w @rf/contracts-ens run typecheck && npm -w @rf/contracts-ens run test
```
→ exits 0

---

**[x] Clear Woodgrove during onboarding and show the pass lapse**

Implement: In `contracts/ens/scripts/onboard.ts`, issue Woodgrove Capital its pass after
Ironline's page, read the wallet and expiry back from chain, then report the pass at today's
date and again at a date past its expiry — recording the investor name, wallet and expiry in
`contracts/ens/deployed.json`.

Verify:
```
npm -w @rf/contracts-ens run onboard:fork
```
→ exits 0 and prints Woodgrove's wallet and expiry read back from chain, then two outcomes:
today `cleared`, past the expiry `lapsed`
