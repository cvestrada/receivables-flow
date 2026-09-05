# Solidity / Hardhat Contract Test Procedure

**What:** Write Hardhat tests for the escrow and forwarder contracts.

**Why:** The escrow release logic is irreversible on-chain. Tests prove the policy (the eligibility policy) is enforced before any real USDC is at risk.

**How:** Deploy contracts to Hardhat's local network, seed USDC, submit receipts, and assert balance changes and events.

---

## Step 1 · Confirm the subject belongs here

Subject belongs: Solidity contracts — `ReceivableEscrow`, `MockForwarder`.

Subject does not belong:
- TypeScript logic that calls contracts (Dynamic wallet signing) → use `ts-unit.md`

---

## Step 2 · Create the test file

Place at: `contracts/test/<ContractName>.test.ts`

Example: `ReceivableEscrow.sol` → `contracts/test/ReceivableEscrow.test.ts`

---

## Step 3 · Bootstrap the test

```ts
import { ethers } from 'hardhat'
import { expect } from 'chai'
import type { ReceivableEscrow, MockForwarder } from '../typechain-types'

describe('ReceivableEscrow', () => {
  let escrow: ReceivableEscrow
  let forwarder: MockForwarder
  let investor: SignerWithAddress
  let smb: SignerWithAddress
  let usdc: MockERC20

  beforeEach(async () => {
    ;[investor, smb] = await ethers.getSigners()

    const USDC = await ethers.getContractFactory('MockERC20')
    usdc = await USDC.deploy('USD Coin', 'USDC', 6)

    const Forwarder = await ethers.getContractFactory('MockForwarder')
    forwarder = await Forwarder.deploy()

    const Escrow = await ethers.getContractFactory('ReceivableEscrow')
    escrow = await Escrow.deploy(
      await usdc.getAddress(),
      await forwarder.getAddress(),
      smb.address,
      650 // score threshold
    )

    // fund investor
    await usdc.mint(investor.address, ethers.parseUnits('1000', 6))
    await usdc.connect(investor).approve(await escrow.getAddress(), ethers.parseUnits('1000', 6))
  })
})
```

---

## Step 4 · Write a receipt builder

Inline in the test file — mirrors the shape the signer produces:

```ts
function buildReceipt(overrides: Partial<{
  compliant: boolean
  score: number
  approved: boolean
}> = {}) {
  return {
    compliant: true,
    score: 82,
    approved: true,
    ...overrides,
  }
}

function encodeReceipt(receipt: ReturnType<typeof buildReceipt>): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['bool', 'uint256', 'bool'],
    [receipt.compliant, receipt.score, receipt.approved]
  )
}
```

---

## Step 5 · Write each it()

Name what happens — no "should". Each `it()` maps to one test from the approved Test Plan.

Follow Arrange → Act → Assert. Assert balance changes and emitted events.

```ts
it('releases USDC to SMB when receipt is valid and score meets threshold', async () => {
  const amount = ethers.parseUnits('50', 6)
  await escrow.connect(investor).depositUSDC(amount)

  const encoded = encodeReceipt(buildReceipt({ score: 700 }))
  const sig = await forwarder.sign(encoded) // MockForwarder signs locally

  const smbBalanceBefore = await usdc.balanceOf(smb.address)
  await escrow.submitProof(encoded, sig)
  const smbBalanceAfter = await usdc.balanceOf(smb.address)

  expect(smbBalanceAfter - smbBalanceBefore).to.equal(amount)
})

it('locks funds when score is below threshold', async () => {
  const amount = ethers.parseUnits('50', 6)
  await escrow.connect(investor).depositUSDC(amount)

  const encoded = encodeReceipt(buildReceipt({ score: 400 }))
  const sig = await forwarder.sign(encoded)

  await escrow.submitProof(encoded, sig)

  expect(await usdc.balanceOf(smb.address)).to.equal(0)
  expect(await escrow.locked()).to.be.true
})

it('reverts when the receipt signature is invalid', async () => {
  const amount = ethers.parseUnits('50', 6)
  await escrow.connect(investor).depositUSDC(amount)

  const encoded = encodeReceipt(buildReceipt())
  const badSig = '0x' + 'ff'.repeat(65)

  await expect(escrow.submitProof(encoded, badSig)).to.be.revertedWith(
    'invalid signature'
  )
})
```

**Run:** `npx hardhat test` (or `pnpm hardhat test`)

---

## Hard Rules

**Always reset state between tests with `beforeEach`**
Deploy fresh contracts per test — never reuse contract state between `it()` blocks.

**Assert balance changes, not just events**
`expect(balanceAfter - balanceBefore).to.equal(amount)` is the ground truth. Events are a secondary check.

**`MockForwarder` signs receipts for L0**
The mock forwarder accepts any locally-signed receipt — this is what a local simulation` deploys. `ReceivableEscrow` points at it for L0 tests. When real `KeystoneForwarder` becomes available (L2), swap the address only.

---

## Full example — minimum viable contract test file

```ts
// contracts/test/ReceivableEscrow.test.ts

import { ethers } from 'hardhat'
import { expect } from 'chai'
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'

describe('ReceivableEscrow', () => {
  let escrow: any
  let forwarder: any
  let usdc: any
  let investor: SignerWithAddress
  let smb: SignerWithAddress

  // ── fixtures ────────────────────────────────────────────────────────────────

  function buildReceipt(overrides: { compliant?: boolean; score?: number; approved?: boolean } = {}) {
    return { compliant: true, score: 82, approved: true, ...overrides }
  }

  function encodeReceipt(r: ReturnType<typeof buildReceipt>) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ['bool', 'uint256', 'bool'],
      [r.compliant, r.score, r.approved]
    )
  }

  // ── setup ────────────────────────────────────────────────────────────────────

  beforeEach(async () => {
    ;[investor, smb] = await ethers.getSigners()

    usdc = await (await ethers.getContractFactory('MockERC20')).deploy('USD Coin', 'USDC', 6)
    forwarder = await (await ethers.getContractFactory('MockForwarder')).deploy()
    escrow = await (await ethers.getContractFactory('ReceivableEscrow')).deploy(
      await usdc.getAddress(),
      await forwarder.getAddress(),
      smb.address,
      650
    )

    await usdc.mint(investor.address, ethers.parseUnits('1000', 6))
    await usdc.connect(investor).approve(await escrow.getAddress(), ethers.parseUnits('1000', 6))
  })

  // ── tests ────────────────────────────────────────────────────────────────────

  it('releases USDC to SMB when receipt is valid and score meets threshold', async () => {
    const amount = ethers.parseUnits('50', 6)
    await escrow.connect(investor).depositUSDC(amount)

    const encoded = encodeReceipt(buildReceipt({ score: 700 }))
    const sig = await forwarder.sign(encoded)
    const before = await usdc.balanceOf(smb.address)

    await escrow.submitProof(encoded, sig)

    expect(await usdc.balanceOf(smb.address) - before).to.equal(amount)
  })

  it('locks funds when score is below the 650 threshold', async () => {
    await escrow.connect(investor).depositUSDC(ethers.parseUnits('50', 6))

    const encoded = encodeReceipt(buildReceipt({ score: 400 }))
    const sig = await forwarder.sign(encoded)
    await escrow.submitProof(encoded, sig)

    expect(await usdc.balanceOf(smb.address)).to.equal(0)
    expect(await escrow.locked()).to.be.true
  })

  it('reverts on invalid receipt signature', async () => {
    await escrow.connect(investor).depositUSDC(ethers.parseUnits('50', 6))

    const encoded = encodeReceipt(buildReceipt())
    const badSig = '0x' + 'ff'.repeat(65)

    await expect(escrow.submitProof(encoded, badSig)).to.be.revertedWith('invalid signature')
  })
})
```
