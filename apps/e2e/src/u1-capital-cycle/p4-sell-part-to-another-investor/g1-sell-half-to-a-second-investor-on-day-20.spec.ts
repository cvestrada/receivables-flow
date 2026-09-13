import { expect, test, type Page } from '@playwright/test';
import { HASHSCAN, INVESTOR, followOut, openSection } from '../portals.support';

/** The dollars in a cell, as a number, so two prices can be compared rather than matched. */
async function dollars(page: Page, testid: string): Promise<number> {
  const text = await page.getByTestId(testid).locator('td').last().innerText();

  return Number(text.replace(/[$,]/g, ''));
}

/*
 * On day 20 the fund gets its cash back without waiting for the invoice to be paid, at a price
 * worked out from Ironline Freight's live record rather than a figure anyone typed. So this
 * reads the rows a person reads — what the two rates are, what a late payment would cost, who
 * holds the receivable afterwards, and what came back — and checks the relationships between
 * them. A hard-coded price would satisfy an equality test and fail most of what is below.
 */
test('Sell half to a second investor on day 20', async ({ page }) => {
  /* Step 1 — the position is on screen with a Sell half action on it. */
  await openSection(page, INVESTOR, 'Held');

  const panel = page.getByRole('region', { name: /^Sell half/ });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('holding');
  await expect(panel.getByRole('button', { name: /^Sell half/ })).toBeVisible();

  /* Step 2 — day 0 and day 20 are quoted side by side, each against what is left to run. */
  const prices = page.getByTestId('resale-price');
  await expect(prices).toBeVisible();
  await expect(prices).toContainText('Bought · day 0');
  await expect(prices).toContainText('Sell half · day 20');
  await expect(prices).toContainText('$50,000 · 60 days');
  await expect(prices).toContainText('$25,000 · 40 days left');

  /* Step 3 — the day-20 price is quoted against the credit score, not against a number we chose. */
  const today = page.getByTestId('resale-price-today');
  await expect(today).toContainText('/ 100');
  await expect(today).toContainText('%');

  /*
   * And a record with one late payment on it never fetches more, with the difference stated on
   * screen as money.
   *
   * Never more, rather than always less: what one late payment is worth depends on how much
   * record it is being added to. On the demo's own six matured invoices it moves the score by
   * several points and the price by hundreds of dollars; on a record this suite has been
   * writing day-60 outcomes into all week, it can move the rounded score by nothing at all and
   * the two rows are the same figure. Both are the formula behaving, so the assertion is the
   * direction and the arithmetic rather than a gap that only exists on a short record.
   */
  const priced = await dollars(page, 'resale-price-today');
  const ifLate = await dollars(page, 'resale-price-if-late');
  expect(ifLate).toBeLessThanOrEqual(priced);

  const cost = page.getByTestId('resale-price-cost-of-late');
  await expect(cost).toBeVisible();
  const stated = Number((await cost.innerText()).replace(/[$,]/g, ''));

  /* Within a cent, so the sentence cannot quote a saving the table does not show. */
  expect(Math.abs(stated - (priced - ifLate))).toBeLessThan(0.01);

  /* Step 4 — the sale settles, leaving two holders on the receivable at half each. */
  await page.getByRole('button', { name: /^Sell half/ }).click();

  const split = page.getByTestId('resale-split');
  await expect(split).toBeVisible({ timeout: 30_000 });
  await expect(split).toContainText('Woodgrove Capital');
  await expect(split).toContainText('Bridgeline Partners');
  await expect(split.getByText('50.00%')).toHaveCount(2);

  /*
   * Step 5 — and the cash comes back at the price the panel quoted. The panel quotes cents and
   * the sale reports whole dollars, so the rounding is the only difference allowed between them.
   */
  const cash = page.getByTestId('resale-cash-back');
  await expect(cash).toBeVisible({ timeout: 30_000 });
  await expect(cash).toContainText(`$${Math.round(priced).toLocaleString('en-US')}`);

  /*
   * Step 6 — the transfer itself, on Hedera, reached from the panel that made it.
   *
   * ATS moved units between two approved holders and this is where a third party goes to see
   * that it did. Skipped when the sale could not settle on this machine: there is no
   * transaction to open, and asserting one anyway would report a chain we never wrote to.
   */
  const receipt = page.getByTestId('resale-transaction');
  if (await receipt.isVisible()) {
    const moved = await followOut(page, receipt, HASHSCAN);
    await moved.close();
  }
});
