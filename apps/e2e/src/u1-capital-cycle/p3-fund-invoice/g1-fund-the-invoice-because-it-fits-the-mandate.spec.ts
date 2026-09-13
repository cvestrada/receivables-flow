import { expect, test, type Page } from '@playwright/test';
import { BUSINESS, INVESTOR, openDay60, openSectionOnDay } from '../portals.support';

/*
 * What the fund's account answers, whichever way it answers.
 *
 * An allocation the mandate permits is signed and sent; one it does not is refused; and on a
 * machine where the accounts were never provisioned the same click comes back saying so. All
 * three are the account answering. What this test will not accept is a click that reaches
 * nobody, or an allocation inside the mandate being turned away by the mandate.
 */
const answered = (page: Page) =>
  page.getByRole('dialog', { name: "What the fund's account answered" });


/*
 * The moment capital moves, and the rules that decide whether it may.
 *
 * The demo shows only the purchase that fits — under the fund's cap, above its score floor —
 * because that is what the cycle needs to continue. The three refusals below are asserted
 * anyway: a rule nobody has watched turn anything away is indistinguishable from no rule, and
 * a run where the mandate had quietly stopped enforcing would otherwise pass in silence.
 *
 * One part of this goal is not on screen yet: the invoice is minted by
 * contracts/hedera-ats/scripts/issue-receivable-token.ts rather than by the directors'
 * approval, and the buy button signs a payment rather than moving both sides at once. The
 * contract that does move both is driven end to end by the day-20 sale in p5.
 */
test('Fund the invoice because it fits the mandate', async ({ page }) => {
  /*
   * Step 1 — an allocation inside the mandate reaches the account and comes back signed. On an
   * unprovisioned machine the answer names the missing setup instead, which is a different
   * sentence from the mandate refusing: the two below must still say "Will not sign".
   */
  await openSectionOnDay(page, INVESTOR, 'Source Invoice', 'Offered');

  await page.getByRole('button', { name: /Fund \$47,990/ }).click();
  await expect(answered(page)).toBeVisible({ timeout: 30_000 });
  await expect(answered(page)).toContainText(/Signed and sent|provisioning/);

  /* Step 2 — over the fund's cap. The account will not sign it. */
  await openSectionOnDay(page, INVESTOR, 'Source Invoice', 'Offered');

  await page.getByRole('button', { name: /Try \$150,000/ }).click();
  await expect(answered(page)).toBeVisible({ timeout: 20_000 });
  await expect(answered(page)).toContainText('Will not sign');
  await expect(answered(page)).not.toContainText('Signed and sent');

  /* Step 3 — into an invoice with no record. The same account refuses for a different reason. */
  await openSectionOnDay(page, INVESTOR, 'Source Invoice', 'Offered');

  await page.getByRole('button', { name: 'Try an unrated invoice' }).click();
  await expect(answered(page)).toBeVisible({ timeout: 20_000 });
  await expect(answered(page)).toContainText('Will not sign');
  await expect(answered(page)).not.toContainText('Signed and sent');


  /*
   * And the third step of this phase, on the seller's side: the day-60 repayment is booked by
   * the network at the moment of sale rather than promised for later.
   */
  await openDay60(page, BUSINESS);

  const booked = page.getByTestId('booked-repayment');
  await expect(booked).toBeVisible();
  await expect(booked).toContainText('booked with the sale');
  await expect(booked).toContainText('Hedera schedule service');
});
