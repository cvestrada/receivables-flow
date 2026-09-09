# Test Plan · Mint the token only when two directors have approved

**Layer:** TS Unit (`libs/privy`) + live integration against Privy and Hedera testnet

**Files:**
- `libs/privy/test/issuance.test.ts` — new, unit
- `libs/privy/test/refusals.test.ts` — existing, its company-account group repointed at the issuance

**Run:** `npm test -w @rf/privy`

Tests live in `libs/privy/test/` rather than `__tests__/`, following the package's existing layout.

---

## Overview

| # | Spec item | Category | Test file |
|---|---|---|---|
| 1 | The directors sign the issuance itself — stable bytes | [unit] | `issuance.test.ts` |
| 2 | The directors sign the issuance itself — right target, right recipient, right entry point | [unit] | `issuance.test.ts` |
| 3 | The amount issued is one note per dollar in six decimals | [unit] | `issuance.test.ts` |
| 4 | Face value comes from the invoice record, not a literal | [unit] | `issuance.test.ts` |
| 5 | One approval issues nothing; two approvals issue the notes | [integration] | `refusals.test.ts` |
| 6 | Ironline's account is the only issuer | [integration] | verified by the issue run, no test file |

Already covered by `approvals.test.ts`, not re-tested here: one director approving twice counts as one approval, and the record reaching two of two.

---

## Tests

**buildIssuanceRequest**

- [happy-path] the same issuance built twice is byte-for-byte identical, so two directors approving hours apart sign the same request
- [happy-path] the issuance is addressed to the note's own contract and moves no money of its own
- [happy-path] the issuance hands the notes to Ironline Freight's shared account
- [happy-path] the issuance calls the mint entry point the deployed ATS interface actually exposes
- [boundary] an issuance for a different note or a different amount produces different bytes, so stability is not constancy

**notesForFaceValue**

- [happy-path] a $50,000 invoice issues 50,000 notes in the token's six decimals
- [boundary] a one dollar invoice issues exactly one note, so the decimal scaling is not off by a magnitude

**issuanceToApprove**

- [happy-path] the issuance offered to the directors carries the face value recorded against invoice INV-2026-0417, not a number written beside it

**Ironline Freight's company account · live, skipped without three director access tokens**

- [unhappy-path] an issuance carrying one director's approval is refused by the account, naming the rule that refused it rather than an empty balance
- [happy-path] the same issuance carrying a second director's approval issues the notes, and the note's supply is zero before it and 50,000 after

**The issue run · live, verified by command output**

- [happy-path] after the issue run, Ironline Freight's account holds the issuer role and is an approved holder of the note
