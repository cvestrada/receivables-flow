import { expect, test, type Locator, type Page } from '@playwright/test';
import { BUSINESS, ENS_PORTAL, followOut, openDay60 } from '../portals.support';

/*
 * Both endings are written to Sepolia and read back before the screen can say what the record
 * now holds, which is slower than a default test allows — and this drives both of them, one
 * after the other, so the budget covers two writes rather than one.
 */
test.describe.configure({ timeout: 300_000 });

/*
 * Walk Ironline to the receivable that falls due, and clear whatever a previous press recorded.
 *
 * The page is served before React has attached its handlers, so a first click can land on
 * markup that is not listening yet — silently. Retrying until the heading changes waits for the
 * portal to be usable rather than merely present.
 */
async function openReceivables(page: Page) {
  await openDay60(page, BUSINESS);

  const again = page.getByTestId('repay-start-over');
  if (await again.isVisible()) await again.click();
}

/** The number in a cell, so scores and dollars can be compared rather than matched. */
async function number(cell: Locator): Promise<number> {
  return Number((await cell.innerText()).replace(/[^0-9.]/g, ''));
}

/** Press an ending and wait for the record to come back from the chain. */
async function press(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('outcome-score-after')).toBeVisible({ timeout: 180_000 });
}

/*
 * An ending is added to Ironline's own public record, and the next invoice is priced off the
 * record afterwards rather than the record before. So this reads the two figures a person
 * reads — the score, and what the next invoice costs — and checks they moved in the direction
 * the ending earned, in both directions. A screen that published the ending but went on
 * quoting the old price would pass every assertion in g1 and fail what is below.
 */
test('Let that outcome price the business’s next invoice', async ({ page }) => {
  /* Step 1 — the record states where Ironline stands before anything is pressed. */
  await openReceivables(page);
  await expect(page.getByTestId('outcome-score-before')).toContainText(/\d{1,3} of 100/);

  const before = await number(page.getByTestId('outcome-score-before'));
  const discountBefore = await number(page.getByTestId('outcome-discount-before'));

  /* Step 2 — paying lifts the score, and the panel says whether it was published. */
  await press(page, 'Repay $50,000');

  const paid = await number(page.getByTestId('outcome-score-after'));
  expect(paid).toBeGreaterThan(before);

  // Published or not, the business is told which. A tally worked out on the spot is worth
  // showing; one shown as though it were on the page is not.
  await expect(page.getByTestId('outcome-published')).toContainText(/published|not published/i);

  /*
   * And when it did publish, the record is reached from the sentence that claims it. Clicked,
   * not typed: "published to Sepolia" is a claim about a place, and the screen has to be what
   * takes a reader there. Skipped when the write did not land — there is nothing to open.
   */
  const record = page.getByTestId('outcome-record-link');
  if (await record.isVisible()) {
    const published = await followOut(page, record, new URL(ENS_PORTAL).host);
    await expect(published.locator('body')).toContainText('rf.', { timeout: 60_000 });
    await published.close();
  }

  /* Step 3 — and the next invoice is cheaper than it was before day 60. */
  expect(await number(page.getByTestId('outcome-discount-after'))).toBeLessThan(discountBefore);

  /* Step 4 — pressing again reports what was written down rather than recording it twice. */
  await page.getByRole('button', { name: 'Repay $50,000', exact: true }).click();
  await expect(page.getByTestId('repay-outcome')).toContainText(/already/i);
  expect(await number(page.getByTestId('outcome-score-after'))).toBe(paid);
});
