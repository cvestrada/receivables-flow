---
name: tests
description: Derive and write tests from a spec file Action Items and Core Logic. One test per testable statement. Use in Phase 2 · Build before any implementation.
---

# /tests — Test Derivation from Spec

**What:** Read a spec file, load the reference for the layer being tested, derive a Test Plan, iterate on it until approved, then write test code.

**Why:** Tests written from the spec bind verification to stated intent — a written, iterable `test.md` lets the human refine coverage without reading TypeScript or Solidity.

**How:** Read `spec.md` → identify the layer → load the layer reference → derive the Test Plan → write it to `test.md` (sibling of `spec.md`) → iterate until approved → write test code.

## SOP

```mermaid
flowchart TD
    START(["/tests invoked"])
    START --> READ_SPEC

    READ_SPEC["Read specs/.../issue-id-slug/spec.md"]
    IDENTIFY["Identify the layer"]
    READ_SPEC --> IDENTIFY

    WRITE_PLAN["Write Test Plan to specs/.../issue-id-slug/test.md"]
    IDENTIFY --> WRITE_PLAN

    APPROVE["🛑 Wait for human to approve test.md"]
    WRITE_PLAN --> APPROVE

    APPROVED{"Human approves?"}
    APPROVE --> APPROVED

    APPROVED -- "no" --> REVISE["Revise test.md per feedback"]
    REVISE --> APPROVE

    APPROVED -- "yes" --> WRITE["Write test code per layer reference"]

    DONE(["Test file written"])
    WRITE --> DONE
```

## Structured Output: Test Status

Print at the top of every response without exception.

**Format:**
```
▶ /tests · [deriving | awaiting approval | writing | done]
  🏗️ Layer:   [layer name or "unknown"]
  📋 Plan:    [specs/.../issue-id-slug/test.md or "not yet determined"]
  📄 File:    [path/to/file.test.ts or "not yet determined"]
  🔄 Status:  [current status]
```

**Example:**
```
▶ /tests · awaiting approval
  🏗️ Layer:   Contracts
  📋 Plan:    specs/02-b-smart-contract/test.md
  📄 File:    contracts/test/ReceivableEscrow.test.ts
  🔄 Status:  awaiting approval
```

## Test Categories (must appear in spec.md and test.md)

Every testable behavior must be tagged with one of three categories. This tag must appear in both spec.md action items and the test.md overview table.

| Category | What it covers | When to use |
|---|---|---|
| **[unit]** | Pure TypeScript function, no real I/O | Validation helpers, eligibility predicates, policy evaluation |
| **[integration]** | Component boundary requiring local infrastructure | API routes, escrow contract |
| **[e2e]** | Full pipeline — contracts on testnet → API → UI | Manual `pnpm run pipeline` + UI check; no automated test file |

See `references/plan.md` for the full mapping and `test.md` format including the required Overview table.

---

## Hard Rules

**Never write code before the Test Plan is approved**
- **What:** Write `test.md` to the worktree first, print only the file path, wait for explicit human approval. Never print test plan contents in the terminal.
- **Why:** Writing code before the human confirms coverage makes the test suite a product of the implementation's logic rather than the spec's intent — tests become self-validating rather than independently verifying.
- **How:** Write `test.md` → print absolute path → stop. Do not write any test code until the human explicitly approves.

**One test per testable statement**
- **What:** Each test maps to exactly one named spec item (Action Item or Core Logic constraint). Do not group multiple assertions under one test name, and do not invent tests not traceable to the spec.
- **Why:** Grouping assertions hides which spec item fails; inventing tests adds coverage for behavior no one agreed on and creates maintenance burden with no spec anchor.
- **How:** For each Action Item Verify clause and each Core Logic Always/Never constraint, write exactly one test. Stop there.

**Follow the layer reference exactly**
- **What:** File location, import style, describe/it structure, assertion library — all come from the layer reference. Do not improvise.
- **Why:** Improvised structure produces tests that pass locally but don't integrate with the test runner or CI config — the layer reference encodes those constraints.
- **How:** Open the layer reference before writing any code and follow it line by line.

## Layers in This Project

| Layer | When to use | Reference |
|---|---|---|
| **TS Unit** | Pure TypeScript logic: helpers, handlers, and any step functions extracted for testing | `references/ts-unit.md` |
| **Contracts** | Solidity: escrow and forwarder contracts | `references/contracts.md` |
| **Next.js API** | Next.js route handlers: `/api/receipt`, `/api/mcp` | `references/nextjs-api.md` |

## References

| Description | File |
|---|---|
| Test planning — derivation logic and Test Plan Format | `references/plan.md` |
| TypeScript unit test conventions (helpers, handlers, step logic) | `references/ts-unit.md` |
| Solidity / Hardhat contract test conventions | `references/contracts.md` |
| Next.js API route test conventions | `references/nextjs-api.md` |
