# TypeScript Unit Test Procedure

**What:** Write unit tests for pure TypeScript logic — signing helpers, request handlers, and step functions extracted for testing.

**Why:** One test per decision path keeps failures easy to pinpoint — no network call, no file I/O, no blockchain needed.

**How:** Pick the right subject file, mock its I/O boundaries with `vi.fn()`, and write one `it()` per code path.

---

## Step 1 · Confirm the subject belongs here

Subject belongs: pure computation or business logic — helper functions, handler logic, step step functions when extractable.

Subject does not belong:
- Next.js API routes that handle HTTP → use `nextjs-api.md`
- Contract interactions that require on-chain state → use `contracts.md`

---

## Step 2 · Create the test file

Place co-located or in a `__tests__/` sibling:

```
src/lib/eligibility.ts                → src/lib/__tests__/eligibility.test.ts
src/lib/tokenize.ts                   → src/lib/__tests__/tokenize.test.ts
src/steps/underwriting.ts             → src/steps/__tests__/underwriting.test.ts
```

---

## Step 3 · Write the test data builder

Inline in the test file, before the describe block:

```ts
function buildReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    compliant: true,
    score: 82,
    approved: true,
    dairyPrice: 1.45,
    txHash: '0xabc123',
    signature: '0xsig',
    ...overrides,
  }
}
```

---

## Step 4 · Write the describe and beforeEach

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getProof } from '../mcp'

describe('getProof', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // it() blocks go here
})
```

Rules:
- One `describe` per exported function or class
- `beforeEach` resets mocks so side effects don't bleed between tests
- Use `vi.fn()` for simple mocks; `vi.mock()` at module level for file I/O or external SDK calls

---

## Step 5 · Mock file I/O and external SDKs

For `receipt.json` reads or Dynamic SDK calls, mock at the module level:

```ts
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}))

vi.mock('@dynamic-labs/sdk-api', () => ({
  createServerWallet: vi.fn(),
}))
```

---

## Step 6 · Write each it()

Name what happens — no "should". Each `it()` maps to one test from the approved Test Plan.

Inside each `it()`, follow Arrange → Act → Assert. Assert only the caller-visible output.

```ts
it('returns the receipt when the file exists and is valid', async () => {
  const receipt = buildReceipt()
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(receipt))

  const result = await getProof()

  expect(result.approved).toBe(true)
  expect(result.signature).toBe('0xsig')
})

it('throws when receipt.json is missing', async () => {
  vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

  await expect(getProof()).rejects.toThrow('ENOENT')
})

it('throws when receipt is missing the signature field', async () => {
  vi.mocked(readFile).mockResolvedValue(JSON.stringify({ compliant: true }))

  await expect(getProof()).rejects.toThrow()
})
```

**Run:** `npx vitest run` (or `pnpm vitest run` if pnpm workspace)

---

## Full example — minimum viable unit test file

```ts
// src/lib/__tests__/tokenize.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFile } from 'fs/promises'
import { getProof } from '../mcp'
import type { Receipt } from '../../types/receipt'

vi.mock('fs/promises')

// ── fixtures ──────────────────────────────────────────────────────────────────

function buildReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    compliant: true,
    score: 82,
    approved: true,
    dairyPrice: 1.45,
    txHash: '0xabc123',
    signature: '0xsig001',
    ...overrides,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('getProof', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns the receipt when the file exists and is valid', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(buildReceipt()) as any)

    const result = await getProof()

    expect(result.approved).toBe(true)
    expect(result.signature).toBe('0xsig001')
  })

  it('throws when receipt.json is missing', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'))

    await expect(getProof()).rejects.toThrow('ENOENT')
  })

  it('throws when receipt lacks the signature field', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ compliant: true, score: 82 }) as any
    )

    await expect(getProof()).rejects.toThrow()
  })
})
```
