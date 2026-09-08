# Settlement — how the money and the asset change hands together

Reference notes for `contracts/hedera-ats/contracts/ReceivableDvp.sol`. Written during
TECH-566. Everything here was checked against the ATS source and a live Hedera testnet
deployment, not recalled.

---

## The gap this fills

ATS is a register. It records who holds a security and what the issuer owes at maturity, and
it deliberately knows nothing about what anyone paid — there is no price field on a token, no
escrow, no exchange. That is correct for a register and it is the same for equities and
bonds alike; real bond issuers hide the gap only because settlement happens in the banking
system, off-chain, where the register never has to see the cash.

Our case makes the gap visible because both legs are on-chain. Without something binding
them, a purchase is two hopeful transfers:

- the investor pays and the token refuses them, so they are out $47,500 holding nothing
- the units move and the payment never comes

**Delivery versus payment** is the standard settlement term for closing that — the asset and
the cash move in the same instant or not at all. It predates blockchain by decades; DTCC and
Euroclear are built on it, and the opposite arrangement is called free-of-payment.

---

## What `ReceivableDvp` is

One contract, three entry points, no custody.

| | |
|---|---|
| `offer(security, units, payment, price)` | The business records terms and gets an offer id |
| `settle(id)` | The investor pays and receives, or the whole transaction reverts |
| `cancel(id)` | The business withdraws an unsettled offer |

`settle` closes the offer, pulls the payment from buyer to seller, then pulls the units from
seller to buyer. Both are `transferFrom`, so nothing ever rests in this contract: there is no
balance to strand when a settlement fails, and no refund path to get wrong.

The refusal an unapproved investor sees is ATS's, not ours. `ReceivableDvp` contains no
compliance check at all — it simply attempts the delivery, and the token's own control list
reverts it. Because both legs share a transaction, that revert takes the payment back too.

---

## Why the contract is on the token's approved list

This surprised us, and it is the one thing to know before reading the code.

The plan was that a pass-through contract would never need whitelisting, since it never holds
a balance. It does need it — but for a different reason. ATS's `approve` carries
`onlyCompliant(sender, spender, false)`, so the token refuses to grant an allowance to a
spender that is not on the control list. Without listing the contract, the business cannot
authorise it in the first place and settlement reverts with `AccountIsBlocked` at setup.

Delivery itself does not check the spender. `transferFrom` carries
`onlyCanTransferFromByPartition(from, to, ...)` — the two parties, not `msg.sender`. So the
contract is listed **as a spender, not as a holder**: listed so it can be authorised, and
pass-through so it never has to be trusted with custody.

---

## What it looks like live

Deployed and source-verified at [`0.0.10425570`](https://hashscan.io/testnet/contract/0.0.10425570), settling
[`0.0.10425572`](https://hashscan.io/testnet/contract/0.0.10425572) — Acme Invoice #1042,
$50,000 face, matures 2026-11-07.

```
cd contracts/hedera-ats && npx hardhat run scripts/demo-settlement.ts
```

Offers the invoice for $47,500, has an unapproved wallet try to buy it, then has an approved
investor buy it. The line to watch is the unapproved buyer's USDC balance after the refusal:
it is unchanged. Two separate transfers could not do that.

---

## Things that cost time to find out

- **The spender must be on the control list**, though the recipient checks are what actually
  govern delivery. See above — this is the whole design constraint.
- **ATS exposes ordinary ERC-20 `approve` and `transferFrom`**, on the `Allowance` and
  `Transfer` facets. A plain `IERC20`-shaped interface is enough; no ATS import is needed in
  the Solidity, which keeps the contract upstreamable.
- **`deployed.json` is written by two scripts.** `issue-receivable-token.ts` originally
  replaced its whole network entry and wiped the settlement address the deploy script had
  just written. Both now merge.
- **The existing token test compared two clocks.** `issueReceivableToken` stamps the starting
  date from the machine clock while Hardhat gives each block a timestamp a second after the
  last, so on a chain that has already run a few hundred transactions they are minutes apart.
  The assertion now uses the wall clock, matching what the code does.
- **`jq` is not installed on this machine.** Verify commands in the spec use `node -e`.
- **HashScan does not hold verified sources itself.** `server-verify.hashscan.io` now
  redirects to Sourcify, and Hedera testnet is chain 296 there. Hardhat's `verify` task still
  speaks Sourcify's retired v1 API and gets an HTML 404 back, so `scripts/verify-hashscan.ts`
  submits to v2 directly. A resubmission completes with `already_verified` rather than a
  match, so the script treats that as success.
- **Only the settlement contract is verifiable as ours.** The receivable token is an ATS
  `ResolverProxy` whose source belongs upstream, not to this repo — there is nothing of ours
  to publish for it.

---

## What is still missing

The price lives in the offer, not on the token. ATS records the $50,000 the issuer owes at
maturity; the $47,500 anyone paid for it is settlement data, and this contract is where it
exists. Nothing reads it back yet — the portals still show the discount from seeded data.

Maturity is also unbuilt. The token carries its maturity date, but nothing pays the holder
out on day 60 or marks the receivable defaulted.
