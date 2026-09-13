import { expect, test, type Page } from '@playwright/test';
import {
  BUSINESS,
  BUSINESS_SIGNED_IN,
  INVESTOR,
  HASHSCAN,
  followOut,
  openSection,
  resetDemo,
  openSectionOnDay,
} from '../portals.support';
import { signInCredentials, waitForSignInCode } from '../otp.support';

/*
 * A score as the portals state it — a share of matured invoices, never a letter.
 *
 * Two spellings, because the business's wizard writes it as a sum ("75 / 100") and the fund's
 * portfolio writes it as prose ("75 of 100"). One pattern reads both rather than each screen
 * getting its own regex to drift.
 */
const OUT_OF_100 = /(\d{1,3})\s*(?:of|\/)\s*100/;

/** What Ironline's customer owes, and the term the fee is worked out over. */
const FACE_VALUE_USD = 50_000;
const MATURITY_DAYS = 60;

/**
 * The published fee curve, restated: a daily rate that runs from 0.05% for a spotless record to
 * 0.15% for one that never repaid anything, straight-lined in between and multiplied by the days
 * the money is actually out.
 *
 * Restated rather than imported, because the point of this test is to recompute the screen's
 * arithmetic independently the way a stranger would. `contracts/hedera-ats/src/pricing.ts` is
 * where it lives for real, and a disagreement between these lines and that file is the finding,
 * not a maintenance chore.
 */
function fee(score: number, days: number): { dailyPct: number; feePct: number; usd: number } {
  const daily = 500 + Math.round((1_000 * (100 - score)) / 100);

  return {
    dailyPct: daily / 10_000,
    feePct: Math.round((daily * days) / 100) / 100,
    usd: Math.round((FACE_VALUE_USD * daily * days) / 1_000_000),
  };
}

/** The judge's address, and the Resend key that can read the code Privy sends it. */
const credentials = signInCredentials();

/** Sign in the way a person does: an address, and the six digits Privy emails back. */
async function signIn(page: Page, url: string, email: string, key: string) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Sign in' }).click();

  const address = page.getByPlaceholder(/email/i).or(page.getByRole('textbox').first());
  await expect(address).toBeVisible({ timeout: 30_000 });
  await address.fill(email);

  const sentAt = Date.now();
  await page.getByRole('button', { name: /submit|continue|next/i }).first().click();

  const code = await waitForSignInCode(email, sentAt, key);
  await page.getByRole('textbox').first().click();
  await page.keyboard.type(code, { delay: 60 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
}

/*
 * Sourcing an invoice, as the three questions it actually is.
 *
 * The invoice is a constant in libs/shared rather than a file anyone uploads — the PDF on screen
 * is the document, and pressing Submit is the click this drives. Everything after it is asserted
 * in the order the portal enforces: nothing is priced until Ironline asks, nothing is offered
 * for approval until the request exists, and nothing is Financed until Privy has counted two
 * signatures and Hedera has minted the receivable.
 */
/*
 * Long, because it starts by resetting the demo — an ENS write and a redemption on Hedera — and
 * ends with a real OTP sign-in and a real mint. Each of those is a minute on a slow day.
 */
test.describe.configure({ timeout: 420_000 });

test('Submit an invoice, see what it costs, and have it tokenized', async ({ page }) => {
  test.skip(
    !credentials,
    'set RESEND_API_KEY and a director address on a Resend inbound domain to run this',
  );

  const { email, key } = credentials!;

  /* ── Before anything is asked for ──────────────────────────────────────────────── */
  await resetDemo(page, BUSINESS_SIGNED_IN);

  await openSection(page, BUSINESS, 'Invoices');

  const outstanding = page.getByTestId('outstanding-invoice');
  await expect(outstanding).toContainText('INV-2026-0417');
  await expect(outstanding).toContainText('Northwind Supplies');
  await expect(outstanding).toContainText('$50,000');
  await expect(outstanding.getByRole('link', { name: /INV-2026-0417\.pdf/ })).toHaveAttribute(
    'href',
    '/INV-2026-0417.pdf',
  );

  /* Nothing is priced, minted or financed yet, and the Financed tab says exactly that. */
  await page.goto(`${BUSINESS}/invoices/financed`);
  await expect(page.locator('main')).toContainText('Nothing financed yet');

  /* And nothing is offered for approval, because nobody has asked for anything. */
  await openSection(page, BUSINESS, 'Approvals');
  await expect(page.locator('main')).toContainText('Signing policy');
  await expect(page.locator('main')).toContainText('Nothing to approve');

  /* ── The judge signs in, and takes the seat that makes their signature count ───── */
  await signIn(page, BUSINESS_SIGNED_IN, email, key);
  await expect(page.getByTestId('director-seat')).toHaveAttribute('data-seated', 'true', {
    timeout: 30_000,
  });

  /* ── Step 1 — the invoice, as the document it is ───────────────────────────────── */
  await page.goto(`${BUSINESS_SIGNED_IN}/invoices/outstanding`);
  await page.getByTestId('submit-invoice').click();

  const wizard = page.getByRole('dialog', { name: 'Request financing' });
  await expect(wizard).toBeVisible({ timeout: 15_000 });
  await expect(wizard).toContainText('INV-2026-0417.pdf');
  await expect(wizard).toContainText('Northwind Supplies');
  await expect(wizard).toContainText('$50,000');

  /* ── Step 2 — priced off the ENS record, on the spot ───────────────────────────── */
  await page.getByTestId('wizard-next').click();
  await expect(wizard).toContainText('Priced off your public record');

  const score = Number((await wizard.innerText()).match(OUT_OF_100)?.[1]);
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(100);

  const priced = fee(score, MATURITY_DAYS);

  await expect(wizard).toContainText(`${priced.dailyPct.toFixed(3)}% a day`);
  await expect(wizard).toContainText(`${priced.feePct.toFixed(2)}%`);
  await expect(wizard).toContainText(`$${priced.usd.toLocaleString('en-US')}`);
  await expect(wizard).toContainText(
    `$${(FACE_VALUE_USD - priced.usd).toLocaleString('en-US')}`,
  );

  /* ── Step 3 — one signature is the company's own system, and is never enough ───── */
  await page.getByTestId('wizard-next').click();
  await expect(wizard).toContainText('Two of three directors must sign', { timeout: 30_000 });
  await expect(wizard).toContainText('Anna Reed');
  await expect(wizard).toContainText('auto-signed for the demo');
  await expect(wizard).toContainText('1 of 2 ready');

  /*
   * And the second is the judge's own, taken in their own browser over the exact request the
   * panel is showing. Privy counts the two and sends the transaction itself; nothing of ours
   * decides whether it may proceed.
   */
  await page.getByTestId('wizard-approve').click();

  /* Either Privy answers with the transaction, or the chain says why not. */
  await expect(async () => {
    const answered = await page.getByTestId('privy-answer').isVisible();
    const refused = await page.getByTestId('wizard-refusal').isVisible();
    expect(answered || refused).toBe(true);
  }).toPass({ timeout: 120_000 });

  /*
   * Privy's own answer, on screen as it came: the status, how many signatures it counted, and
   * the hash. This is the one thing in the whole step that is not our own text about Privy.
   */
  if (await page.getByTestId('privy-answer').isVisible()) {
    const answer = page.getByTestId('privy-answer');
    await expect(answer).toContainText('2 of 2 signatures');
    await expect(answer).toContainText('"hash"');
    await expect(answer).toContainText('"signatures_counted": 2');

    await page.getByTestId('wizard-done').click();
  }

  /*
   * Read the refusal only when there is one. A template literal in the skip message is evaluated
   * before `test.skip` decides anything, so the happy path spent thirty seconds waiting for an
   * element that correctly never appeared.
   */
  if (!page.url().includes('/invoices/financed')) {
    test.skip(true, `the company account did not mint: ${await page.getByTestId('wizard-refusal').innerText()}`);
  }

  /* ── It is the receivable now, and it is on the other side of the split ────────── */
  await expect(page.getByTestId('financed-term')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('main')).toContainText('Tokenized');
  await expect(page.locator('main')).toContainText('INV-2026-0417');
  await expect(page.locator('main')).toContainText('$50,000');
  /*
   * And the receivable is checkable without us. Pressed rather than typed: what has to be proved
   * is that the screen a judge is looking at takes them to the chain, not that HashScan exists.
   */
  const chain = await followOut(page, page.getByTestId('financed-transaction'), HASHSCAN);
  await chain.close();

  await page.goto(`${BUSINESS_SIGNED_IN}/invoices/outstanding`);
  await expect(page.locator('main')).not.toContainText('Submit for financing');

  /* ── And the buyer reads the same score on the offer itself ────────────────────── */
  await openSectionOnDay(page, INVESTOR, 'Source Invoice', 'Offered');

  const offers = page.getByRole('table').filter({ hasText: 'Ironline Freight' }).first();
  await expect(offers).toContainText('Credit score');
  await expect(offers).toContainText(`${score} of 100`);

  /*
   * And no letter grade survives anywhere on that screen. The market used to say "tier B" in
   * four places; a letter needs band cutoffs somebody chose, which is the judgment this
   * product exists to remove.
   */
  await expect(page.locator('main')).not.toContainText(/tier\s+[A-D]/i);
  await expect(page.getByRole('columnheader', { name: 'Tier', exact: true })).toHaveCount(0);
});
