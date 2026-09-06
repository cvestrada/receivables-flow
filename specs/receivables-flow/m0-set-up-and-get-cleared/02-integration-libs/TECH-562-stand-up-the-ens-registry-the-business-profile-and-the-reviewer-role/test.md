# Test Plan — TECH-562

Three tiers. Unit and integration run today with no funded account; end-to-end waits on
TECH-580.

| Tier | Runs against | Needs funds | Command |
|---|---|---|---|
| Unit | pure functions, no network | no | `npm -w @rf/contracts-ens run test:unit` |
| Integration | a Sepolia **fork** — real ENSv2 contracts, fake funded accounts | no | `npm -w @rf/contracts-ens run test:int` |
| End-to-end | real Sepolia | yes — TECH-580 | `npm -w @rf/contracts-ens run onboard -- --network sepolia` |

---

## Unit — `test/unit/encoding.test.ts`

Pure input/output. No chain.

| # | Statement under test | Assertion |
|---|---|---|
| 1 | A name is encoded in the wire format the resolver expects | `ironline.receivablesflow.eth` encodes to its length-prefixed label form, terminated by a zero byte |
| 2 | A reviewer's setter blob names the field it scopes to | the blob for `credit.rating` carries that key verbatim |
| 3 | Two fields build two different blobs | the blob for `credit.rating` differs from the one for `description` |
| 4 | The same field always builds the same blob | building `credit.rating` twice is byte-identical |
| 5 | A business profile is exactly its four records | the record set is financed, repaid, defaulted, rating — no more, no fewer |

---

## Integration — `test/integration/registry.test.ts`

Hardhat forking Sepolia at a pinned block, so the deployed ENSv2 contracts are real and the
accounts are funded fakes. Deterministic and offline-repeatable once the block is cached.

### Standing up the registry

| # | Statement under test | Assertion |
|---|---|---|
| 6 | The platform ends up owning its public name | the base name resolves to the platform account |
| 7 | The platform's own registry is live beneath it | the base name's subregistry is the deployed registry, not the default |
| 8 | Opening the registry twice does not open a second one | a second call returns the same registry address |

### Giving a company its page

| # | Statement under test | Assertion |
|---|---|---|
| 9 | The company gets a name that resolves | `ironline.receivablesflow.eth` resolves to the company's wallet |
| 10 | The platform keeps ownership, the company never gets it | the name's owner is the platform account, not the company |
| 11 | Issuing the same page twice does not issue a second name | a second call leaves the owner and address unchanged |

### Writing the record

| # | Statement under test | Assertion |
|---|---|---|
| 12 | The counts read back as written | financed, repaid and defaulted match what was written |
| 13 | Counts are stored raw, not as a grade | each count reads back as its own number; no combined score field exists |
| 14 | Rewriting a count replaces it rather than appending | writing a new repaid count leaves exactly one value |

### The reviewer role — the load-bearing behaviour

| # | Statement under test | Assertion |
|---|---|---|
| 15 | The appointed reviewer can set the rating | the write succeeds and the rating reads back |
| 16 | The reviewer cannot touch any other field | writing `description` as the reviewer reverts |
| 17 | The business cannot set its own rating | writing the rating as the company reverts — the demo moment |
| 18 | The business cannot touch any field on its own page | writing any record as the company reverts |
| 19 | An unappointed stranger cannot set the rating | writing the rating from a random account reverts |
| 20 | The platform can revoke the reviewer | after revocation the reviewer's rating write reverts |
| 21 | Appointing is scoped per company, not globally | a reviewer appointed on one company's page cannot write another company's rating |

---

## End-to-end — deferred to TECH-580

Real Sepolia, real money, real links a judge can click. Asserted by the onboarding script's
printed output rather than a test runner.

| # | Statement under test | Assertion |
|---|---|---|
| 22 | The whole sequence runs against the live chain | script exits 0 and prints the registry address and issued name |
| 23 | The record is readable by a stranger | the counts read back over a public RPC with no platform involvement |
| 24 | The refusals hold on the real chain | reviewer-on-rating `ok`; reviewer-elsewhere `refused`; business-anywhere `refused` |
| 25 | Re-running changes nothing | `deployed.json` is byte-identical after a second run |
