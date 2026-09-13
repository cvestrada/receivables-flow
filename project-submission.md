# ETHOnline 2026 Project Submission - Receivables Flow

Every field on https://ethglobal.com/events/ethonline2026/project. Copy each answer into the form. `TODO` = needs a link or file not in the repo.

---

## 1. Project details

### Project name

Receivables Flow

### What category does your project belong to?

DeFi / RWA

### What emoji best represents your project?

🌊

### If you have a demonstration, link to it here!

TODO — live portal URL or demo video link.

### Short description
*(≤100 characters)*

An unpaid invoice becomes a token an approved investor can buy, resell early, and get repaid on.

### Description
*(min 280 characters)*

A business is owed $50,000 and has to wait 60 days for it. Payroll does not wait. Invoice financing exists for this, but it has two problems: the investor's money is locked until the customer pays, and nobody outside one lender can see whether the business pays on time.

Receivables Flow fixes both. The business's directors approve the sale two-of-three, the invoice becomes a token on Hedera that only approved investors can hold, and a fund buys it today for $47,500. The fund can sell half to another investor on day 20 instead of waiting. On day 60 the business repays and every holder gets its share.

Then the loop closes: the on-time repayment is written to the business's ENS name, its credit score goes up, and its next invoice sells at a smaller discount. Good businesses earn cheaper money from their own public record.

### How it's made
*(min 280 characters)*

Three sponsors, one job each.

**Hedera** holds the asset and the money. The invoice is issued with Asset Tokenization Studio as a whitelist-only security ($50,000 face value, 60-day maturity). We wrote three small contracts on top: a delivery-versus-payment contract that moves the USDC and the token in one transaction or not at all, a KYC list that ATS checks inside every transfer, and a mock USDC so a $50,000 repayment can be real on testnet. Resale on day 20 and repayment on day 60 are ATS lifecycle operations, each visible on HashScan.

**ENS** decides who may hold and what their record says. Built on the ENSv2 beta on Sepolia: `receivablesflow.eth` issues `ironline.business.` and `woodgrove.investor.` names, each with a Permissioned Resolver. KYC is a record on the name plus the name's expiry, mirrored to Hedera so the token itself refuses unapproved wallets. Repayment history is three counts on the business's name, and the next invoice's price is computed from them live.

**Privy** decides who may act. The business is one company account owned by three directors with a two-of-three key quorum — one signature is refused by Privy, not by us. The fund is a server-owned account under a policy: never above $100,000, never into an unrated invoice, refused with no one to ask.

**Apps.** Three Next.js portals (business, investor, HQ) and one Playwright suite that clicks every step and asserts it on screen.

### GitHub Repositories

https://github.com/cvestrada/receivables-flow

---

## 2. Images

### Logo
*(square, e.g. 512x512)*

TODO

### Cover image
*(16:9, e.g. 640x360)*

TODO — investor portal with the $47,500 quote and credit score.

### Screenshots
*(minimum 3)*

TODO:

1. Business portal — approvals at 2 of 2, with Privy's refusal at 1 of 2.
2. Investor portal — $150,000 allocation refused as over the cap.
3. Investor portal — half sold to a second investor on day 20.
4. Business portal — day 60 repaid, both holders paid, HashScan links.
5. HQ — KYC list read live from ENS.
6. Business portal — next invoice quoted cheaper.

---

## 3. Tech stack

### Are you using any Ethereum developer tools for your project?

Hardhat, ethers.js v6, ENSv2 beta, Privy, Playwright, Vitest

### Which blockchain networks will your project interact with?

Hedera Testnet, Ethereum Sepolia

### Which programming languages are you using in your project?

TypeScript, Solidity

### Are you using any web frameworks for your project?

Next.js 16, React 19, Tailwind CSS 4

### Are you using any databases for your project?

SQLite (journey map only — portals read from chain)

### Are you using any design tools for your project?

None

### Other specific technologies, libraries, frameworks, or tools

Hedera Asset Tokenization Studio, Hedera Schedule Service, HashScan, ENSv2 Permissioned Resolver, Privy key quorums and policies, delivery-versus-payment settlement contract, npm workspaces

### Describe how AI tools were used in your project

Claude Code was the pair programmer for the whole build; every commit carries its co-author line. Each issue got a written spec first, Claude derived the tests from it, then implemented against them. Claude also did the research that cost time — the hackathon ENSv2 deployment differs from production, ATS cannot be forked locally, Circle's faucet caps at $20. All decisions about what to build and what to cut were made by the human.

---

## 4. Select prizes

### Select your track for ETHOnline 2026

DeFi

### Submission type

Project

### Which partner prizes are you applying for?
*(max 3)*

1. Hedera — Tokenization of Anything
2. ENS — Best Use of ENSv2
3. Privy — Best B2B Financial Product

### Why is your project applicable for each selected prize?

**Hedera.** The receivable goes through ATS's full lifecycle, not a single mint: issued whitelist-only, transfer-restricted by a KYC list ATS checks on every transfer, bought and resold through delivery-versus-payment, and repaid at maturity with each holder paid separately. Token `0.0.10425572`, settlement contract `0.0.10425570` (source verified).

**ENS.** ENSv2 beta on Sepolia, hierarchical registries and Permissioned Resolver, and every record gates something: KYC on the name decides who the Hedera token will accept, and the repayment counts on the name set the price of the next invoice. Functional, not a display name.

**Privy.** The business is an organization with a two-of-three key quorum; the fund is a server-owned account under a policy with a spending cap and an allowed list. Both refusals come from Privy and are shown unchanged.

### Which other partners' technologies have you used on your project?

None.

---

## 5. Video

### Demo video
*(2–4 min, 720p+, audio no music)*

TODO — link.

---

## 6. Future

### Are you interested in continuing your project?

Yes. Next: real USDC on Hedera mainnet, a notice of assignment so the customer pays the funder direct, an open order book for early resale, and the credit score as a public ENS record any lender can read.

---

## 7. Final

### Team

Carlos Estrada — github.com/cvestrada. TODO: ETHGlobal handle and any teammates.

### Confirmation checkboxes

- I will be starting this project from scratch — Yes (first commit 2026-09-04)
- I will be using github and committing changes frequently — Yes (126 commits, 21 PRs)
- I will be open-sourcing my submission — Yes
- I will not be submitting this project to another hackathon — Yes
- I will abide by all official ETHGlobal event rules — Yes
- I confirm that the work I am submitting was built entirely during this hackathon and no work was completed before the event — Yes
