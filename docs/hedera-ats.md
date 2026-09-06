# Hedera ATS — what we use, and how we test it

Reference notes for `contracts/hedera-ats`. Written during TECH-563. Everything here was
checked against the ATS source and the Hedera mirror node, not recalled.

---

## We write no Solidity

An ATS token is a small proxy that delegates everything to 108 shared facets. Those facets
are deployed once per network; the Factory stamps out one proxy per invoice and wires it to
the bond facet set. So issuing an invoice is one transaction, not a deployment.

Our code does five things:

1. Map an invoice onto the parameters ATS expects
2. Generate a checksum-valid ISIN
3. Call `deployBond` and read the token address out of the `BondDeployed` event
4. Record that address in `deployed.json`
5. Call `addToControlList` / `removeFromControlList` to change who may hold the token

ATS does everything else — deploying the token, whitelist mode, storing the approved list,
and rejecting transfers to addresses that are not on it.

Package: `@hashgraph/asset-tokenization-contracts` (npm, Apache-2.0). It ships the compiled
artifacts, TypeChain types, and — usefully — its deploy scripts and `deployBondFromFactory`
helper, which is why we can stand the whole system up locally.

---

## The ATS deployment we point at

`.env` overrides these; unset, the code falls back to them.

| | Hedera contract ID | EVM address |
|---|---|---|
| Factory | `0.0.9213391` | `0xd1F118A40f3b02883D35909eF2517e7EDd78379d` |
| BusinessLogicResolver | `0.0.9212226` | `0xBA2D5FC2083A0b8f164c50e65d782087fBA18E0a` |

**How this was verified** — not taken on trust:

- Queried `https://testnet.mirrornode.hedera.com/api/v1/contracts/0.0.9213391`: live,
  `deleted: false`, real runtime bytecode, created 2026-06-12.
- ATS's own web app ships these exact IDs in its `.env.example`, labelled "Preconfigured for
  Hedera Testnet". This is the deployment the official ATS UI points at out of the box.

**Two things to know about it.** The mirror node reports an expiry around 2026-09-10 with no
auto-renew account set — Hedera has historically deferred enforcing contract expiry, so it
will most likely keep working, but that is not a guarantee. And upstream treats these as a
convenience default, not a public utility: both env files say "Replace with your deployed
contract IDs." Deploying our own system is one upstream command
(`deploySystemWithNewBlr`) and costs ~180M gas and ~29 minutes.

---

## How we test, and how that differs from Hedera's advice

We run the suite against **Hardhat's in-memory EVM** — a blank chain created when the command
starts and discarded when it exits. The full ATS system is deployed into it per run.

Hedera's documented local path is different:

| | What we do | Hedera recommends |
|---|---|---|
| Network | Hardhat in-memory EVM | Solo (local Hedera on Kubernetes), or a Hardhat fork of testnet |
| Consensus | none, instant blocks | real Hedera consensus |
| HTS precompiles (`0x167`) | absent | present |
| Gas and transaction-size limits | Ethereum's | Hedera's |
| Mirror node | none | real |
| Cost to run | zero, about 40 seconds | Docker/Kubernetes, or a funded account |

**Why the gap is acceptable here.** That tooling exists chiefly to emulate Hedera's token
service precompiles. ATS does not use them — it is pure ERC-1400/ERC-3643 Solidity, confirmed
by grepping the contract source for `0x167` and `IHederaTokenService` and finding nothing.
Upstream ATS tests on plain Hardhat for the same reason.

**What our tests therefore do not prove:** behaviour under Hedera's gas and transaction-size
limits, and that the live Factory above behaves identically. Closing that needs a funded
account (TECH-580). The cheapest upgrade after that is Hardhat forking of testnet via
`@hashgraph/system-contracts-forking`.

Hiero Local Node, which older guides recommend, entered a six-month deprecation ending
September 2026. Solo replaces it.

---

## Things that cost time to find out

- **Role names must be passed as hashes.** `{ role: 'ROLE_CONTROL_LIST' }` fails at ABI
  encoding with `invalid BytesLike value`. Use `ATS_ROLES.ROLE_CONTROL_LIST`.
- **The ISIN check digit is validated on-chain.** The Factory reverts with `WrongISIN` or
  `WrongISINChecksum`, so the digit is computed, never typed.
- **Whitelist mode is fixed at creation.** `isWhiteList` cannot be flipped afterwards, so a
  token issued without it can never be locked down later — it has to be reissued.
- **The token's own admin must be on the approved list** before it can hold the supply it
  mints. Whitelist mode is live from creation and does not exempt the issuer.
- **`resolverProxyConfiguration` is required by the type** even though
  `deployBondFromFactory` overwrites it with the bond config ID.
- **Face value is not one field.** ATS stores a per-unit nominal value and a supply cap; the
  invoice total is those two multiplied.
- **The deploy writes a `deployments/` checkpoint directory** as a side effect. It is ignored.

---

## Seeing it work

```
cd contracts/hedera-ats && npx hardhat run scripts/demo-receivable-token.ts
```

Issues the demo invoice and walks through the refusal, the approval, the withdrawal, and an
unauthorised approval attempt. The revert reasons are decoded from raw EVM revert data, so
`AccountIsBlocked` and `AccountHasNoRole` come out of ATS's Solidity rather than from our
own logging. A transcript is in `hedera-ats-demo.txt` next to this file.
