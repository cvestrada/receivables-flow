# Next.js API Route Test Procedure

**What:** Write tests for Next.js API route handlers — the project API route handlers.

**Why:** Route tests catch wiring problems (missing file reads, bad response shapes, wrong status codes) that pure unit tests of helper functions can't reach.

**How:** Import the route handler, call it directly with a mock `NextRequest`, assert the response status and JSON body.

---

## Step 1 · Confirm the subject belongs here

Subject belongs: `src/app/api/**/ route.ts` — Next.js App Router route handlers.

Subject does not belong:
- Pure helper functions called by the route (e.g. `getProof` logic) → use `ts-unit.md`

---

## Step 2 · Create the test file

Place co-located in an `__tests__/` folder next to the route:

```
src/app/api/receipt/route.ts  →  src/app/api/receipt/__tests__/route.test.ts
src/app/api/mcp/route.ts      →  src/app/api/mcp/__tests__/route.test.ts
```

---

## Step 3 · Mock file I/O at the module level

Routes read `receipt.json` from disk. Mock `fs/promises` before importing the route handler:

```ts
vi.mock('fs/promises')
import { readFile } from 'fs/promises'
import { GET } from '../route'
```

---

## Step 4 · Build a mock NextRequest

Next.js App Router handlers receive a `NextRequest`. Build one inline:

```ts
function makeRequest(method = 'GET', body?: object): NextRequest {
  return new NextRequest(`http://localhost/api/receipt`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}
```

---

## Step 5 · Write each it()

Name what happens — no "should". Call the handler, await the response, parse JSON, and assert.

```ts
it('returns the receipt JSON with status 200 when file exists', async () => {
  const receipt = buildReceipt()
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(receipt) as any)

  const res = await GET(makeRequest())
  const body = await res.json()

  expect(res.status).toBe(200)
  expect(body.approved).toBe(true)
  expect(body.signature).toBe('0xsig001')
})

it('returns 500 when receipt.json is missing', async () => {
  vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

  const res = await GET(makeRequest())

  expect(res.status).toBe(500)
})
```

**Run:** `npx vitest run` (or `pnpm vitest run`)

---

## Step 6 · MCP route specifics

A route that wraps a tool call. Call it with the tool request body:

```ts
it('returns the payload when the tool is called', async () => {
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(buildReceipt()) as any)

  const req = new NextRequest('http://localhost/api/mcp', {
    method: 'POST',
    body: JSON.stringify({ tool: 'get_record', params: {} }),
    headers: { 'Content-Type': 'application/json' },
  })

  const res = await POST(req)
  const body = await res.json()

  expect(res.status).toBe(200)
  expect(body.result.approved).toBe(true)
})

it('returns 400 when an unknown tool is called', async () => {
  const req = new NextRequest('http://localhost/api/mcp', {
    method: 'POST',
    body: JSON.stringify({ tool: 'unknown_tool', params: {} }),
    headers: { 'Content-Type': 'application/json' },
  })

  const res = await POST(req)

  expect(res.status).toBe(400)
})
```

---

## Hard Rules

**Import `NextRequest` from `next/server`, not from `node-fetch` or elsewhere**
The App Router handler type-checks against `NextRequest` — the test must use the same class.

**Never mock the route itself**
Mock only the dependencies the route calls (file system, external SDKs). The route handler under test must run real code.

**Assert status codes before body fields**
A 500 with an error body that has `approved: true` is still wrong — check status first.

---

## Full example — minimum viable API route test file

```ts
// src/app/api/receipt/__tests__/route.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import type { Receipt } from '../../../../types/receipt'

vi.mock('fs/promises')

// Import AFTER vi.mock so the module receives the mocked version
const { GET } = await import('../route')

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

describe('GET /api/receipt', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns the receipt with status 200 when file exists', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(buildReceipt()) as any)

    const res = await GET(new NextRequest('http://localhost/api/receipt'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.approved).toBe(true)
    expect(body.signature).toBe('0xsig001')
  })

  it('returns 500 when receipt.json is missing', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'))

    const res = await GET(new NextRequest('http://localhost/api/receipt'))

    expect(res.status).toBe(500)
  })

  it('returns 500 when receipt.json contains invalid JSON', async () => {
    vi.mocked(readFile).mockResolvedValue('not valid json' as any)

    const res = await GET(new NextRequest('http://localhost/api/receipt'))

    expect(res.status).toBe(500)
  })
})
```
