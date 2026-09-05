# Test Planning Reference

**What:** List every test that needs to be written before touching any code.

**Why:** Tests derived from the spec — not from the code — make sure every stated requirement gets checked.

**How:** Read the spec, identify the layer, derive the test list ordered by method, write to `test.md`, and wait for approval before writing any code.

---

## Test Categories

Every test in this project belongs to exactly one of three categories.

| Category | What it tests | Runner | Reference |
|---|---|---|---|
| **Unit** | A single pure TypeScript function in isolation | `vitest` | `ts-unit.md` |
| **Integration** | A component boundary requiring real infrastructure (local Hardhat node or real `receipt.json`) | `vitest` (routes) · `hardhat test` (contracts) | `nextjs-api.md` · `contracts.md` |
| **E2E** | Full pipeline — contracts on testnet → API → UI | `pnpm run pipeline` + manual check | (script, not a test file) |

### Which category does this test belong to?

Ask one question: **what does this test require to be running?**

- Nothing external (pure function, mock I/O) → **Unit**
- A local Hardhat node OR a real `receipt.json` on disk → **Integration**
- Hedera testnet + ATS deployment + running UI → **E2E**

### Receivables Flow mapping

| Subject | Category | Why |
|---|---|---|
| Invoice validation / amount + due-date math | Unit | Pure computation, no external state |
| Eligibility predicate (credit tier → allowed?) | Unit | Pure function over a resolved ENS text record |
| ENS resolver record parsing | Unit | Pure decode, mock the resolver response |
| Privy quorum policy evaluation | Unit | Pure rule check over a policy object, mock the SDK |
| ATS token mint / restrict / redeem | Integration | Requires a deployed ATS contract on a local or test network |
| ENS Permissioned Resolver reads | Integration | Requires ENSv2 beta on Sepolia; tests real wildcard resolution |
| Privy org wallet + approval flow | Integration | Requires live Privy org wallets; tests policy → signature wiring |
| Investor funding route handler | Integration | Wires request → eligibility check → transfer; real path, mocked chain |
| Full lifecycle (issue → approve → tokenize → fund → redeem) | E2E | Requires Hedera testnet, ENS Sepolia, Privy org, running UI |

---

## Step 1 · Identify testable behaviors

**If the spec contains a Core Logic diagram, read it first — it is the primary source of tests.** Map each branch arm and blocking condition to a test.

Classify every behavior with one tag:

| Tag | Question |
|---|---|
| [happy-path] | What is the correct outcome for valid input — return value, state change, or side effect? |
| [boundary] | Are edge-case inputs handled safely — null, empty, min/max, invalid format? |
| [unhappy-path] | Does it fail gracefully for bad input or error state — right error type, no state corruption? |

---

## Step 2 · Group by service → entity → method

**Top level:** bold service or contract name.

**Second level (optional):** bold entity group — only when the subject has two or more meaningfully distinct entity types (e.g. `Receipt` vs `Policy`). Skip this level when the service has one entity type.

**Third level:** bold method name.

**Within each method, order by tag:**
1. [happy-path] — valid input, expected return value or state change
2. [boundary] — edge-case inputs (null, empty, min/max)
3. [unhappy-path] — bad input or error state, correct failure behavior

**Test descriptions are plain English business intent** — describe what the system does in that case, not the implementation detail.

- Good: `[happy-path] a new verification record is opened for a business starting KYB`
- Bad: `[happy-path] createVerification inserts a row with status awaiting_report` ← implementation detail

---

## Step 3 · Write test.md and wait for approval

Write the test plan to `specs/.../issue-id-slug/test.md`. Print only the file path — never print the file contents in the terminal.

```markdown
# Test Plan · [Issue title]

**Layer:** [BE unit / FE unit / Contract / Next.js API / etc.]

**File:** `path/to/file.test.ts`

**Run:** `pnpm nx test <project-name>` (or `npx hardhat test`)

---

## Tests

**ServiceOrContractName**

- **EntityGroup** (omit this level if only one entity type)
  - **methodName**
    - [happy-path] plain English description
    - [happy-path] second distinct case
    - [boundary] edge-case description
    - [unhappy-path] error case description

- **methodName** (when no entity grouping)
  - [happy-path] plain English description
  - [unhappy-path] plain English description
```

After writing, print the absolute path and wait for explicit approval. Do not write any test code until approved.
