---
name: code-comment
description: Code comment standard for Orbbit — when to comment, required format, and what to write.
license: MIT
allowed-tools: Read, Edit, Bash
---

# /code-comment — Code Comment Standard

**What:** Apply Orbbit's comment standard to code being written or reviewed.

**Why:** Verification cost is the bottleneck. A human reading uncommented workflow code has to mentally reconstruct the logic diagram from the implementation — that is reconstruction, not recognition. Comments that mark which step of a logic diagram each block implements convert verification from reconstruction to recognition, which is the goal of Zone 1 execution.

**How:** First, add step marker comments at every phase of any logic diagram implemented in the function. Then scan for the four other comment triggers. Remove anything that violates the rules.

## When to comment

### Logic diagram step markers — always required

Any function that implements a spec flowchart, SOP, or sequence diagram **must** have a step marker comment at each logical phase. The goal: a reviewer must be able to read only the comments and know exactly which step of the diagram each block implements — without reading the code.

```typescript
/*
 * Try the onchain rail first — it settles faster than a bank transfer.
 */
const { paymentId } = await createPayment({ collectionId, rail: 'onchain' });
const onchainResult = await executeChild(onchainDebitWorkflow, { ... });

if (onchainResult.status === 'succeeded') { ... }

/*
 * Onchain debit failed — fall back to the bank rail.
 */
const achResult = await executeChild(achDebitWorkflow, { ... });
```

One comment per phase, placed at the start of that phase's block. The comment names the step and states what triggers or concludes it.

### Other cases requiring a comment

Write a comment when the reason behind the code is not obvious from reading it:

- **Hidden constraint** — an external system, protocol, or legal rule forces this shape.
- **Subtle invariant** — the code breaks silently if a caller violates an assumption that is not enforced by types.
- **Known workaround** — this is intentionally non-obvious because the straightforward path has a known bug or limitation.
- **Surprising behavior** — a future reader would reasonably expect different behavior and change it.

Do not comment:
- What the code does — the identifiers describe that.
- Why a function exists or who calls it — that belongs in the PR description or Linear issue.
- Obvious steps (`// increment counter`, `// return result`).

## Format

Two formats — one for function-level docs, one for inline body comments. Never use `//`.

### Function-level: `/** */` TSDoc

Use on non-obvious functions to describe purpose, inputs, and outputs. Skip it when the function name and types already tell the full story.

```typescript
/**
 * Returns only the schemas that belong to the application.
 *
 * Postgres ships with built-in schemas (pg_catalog, information_schema, etc.)
 * and Atlas adds its own tracking schema. Including them would pollute the
 * Database type with hundreds of internal rows.
 *
 * @param schemas - All schema names returned from the database
 * @returns Schema names that belong to the application
 */
function filterApplicationSchemas(schemas: string[]): string[]
```

Rules:
- First line: plain English sentence describing what the function does from the caller's point of view.
- Body: the non-obvious WHY — hidden constraint, surprising exclusion, or external rule that shapes the implementation. Skip if nothing non-obvious exists.
- `@param` and `@returns`: one plain English phrase each. Never restate the type — the type signature already has it. Never use the parameter name as the description.
- No abstract terms. Describe what actually happens, not how the function is categorised.

**Wrong — restates the type:**
```typescript
 * @param schemas - string[] of schema names
```

**Wrong — abstract:**
```typescript
 * Performs schema filtration by applying exclusion predicates.
```

**Correct:**
```typescript
 * @param schemas - All schema names returned from the database
 * @returns Schema names that belong to the application
```

### Inline body: `/* */` block

Use inside function bodies for phase markers and non-obvious decisions. One blank line before the comment, no blank line between the comment and the code it describes.

```typescript
/*
 * Wait here until on-chain confirmation arrives.
 * Polling stops as soon as the receipt status is confirmed.
 */
const receipt = await waitForConfirmation(txHash);
```

**Wrong — inline style:**
```typescript
const receipt = await waitForConfirmation(txHash); // wait for on-chain confirmation
```

**Wrong — states the obvious:**
```typescript
/*
 * Call waitForConfirmation with the transaction hash.
 */
const receipt = await waitForConfirmation(txHash);
```

**Wrong — jargon:**
```typescript
/*
 * Idempotently poll the mempool until finality is achieved via RPC subscription.
 */
const receipt = await waitForConfirmation(txHash);
```

## Language rules

- Plain English. Write as if explaining to a teammate, not a documentation reader.
- No abbreviations unless universally understood (e.g., `ID`, `URL`).
- No internal identifiers, ticket numbers, or PR references.
- No abstract function names in comments — describe what actually happens, not the method being called.
- One idea per comment. If you need two ideas, write two comments on two separate blocks.
- Active voice. "Wait here until X arrives" not "X is waited for until it arrives".

## Applying this skill

1. Identify whether the function implements a logic diagram (flowchart, SOP, sequence diagram). If yes, add a step marker comment at the start of each phase before doing anything else.
2. Read each existing comment and ask: would a reader be confused without this?
   - Yes → keep it, rewrite to the block format if needed.
   - No → delete it.
3. Scan for code that has no comment but meets one of the four criteria above. Add a comment.
4. Rewrite any surviving comment that uses jargon, states the obvious, or uses inline `//` style.
