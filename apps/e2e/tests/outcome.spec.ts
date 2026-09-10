import { expect, test, type Locator, type Page } from '@playwright/test';

const BUSINESS = 'http://127.0.0.1:3200';

/*
 * Walk Ironline to the receivable that falls due, and clear whatever a previous run recorded.
 *
 * The page is served before React has attached its handlers, so a first click can land on
 * markup that is not listening yet — silently. Retrying until the heading changes waits for the
 * portal to be usable rather than merely present.
 */
async function openReceivables(page: Page) {
  await page.goto(BUSINESS);

  await expect(async () => {
    await page.getByRole('button', { name: /^Receivables/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Receivables', {
      timeout: 1000,
    });
  }).toPass({ timeout: 30_000 });

  /* Day 60 is recorded once, so every test has to start from a day 60 that has not happened. */
  const again = page.getByTestId('repay-start-over');
  if (await again.isVisible()) await again.click();
}

/** The number in a cell, so scores and dollars can be compared rather than matched. */
async function number(cell: Locator): Promise<number> {
  return Number((await cell.innerText()).replace(/[^0-9.]/g, ''));
}

/*
 * Press an ending and wait for the record to come back.
 *
 * The wait is long because the ending is written to Sepolia and read back before the screen can
 * say what the page now holds — a shorter wait would fail on a slow block rather than on a
 * broken feature.
 */
async function press(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('outcome-score-after')).toBeVisible({ timeout: 180_000 });
}

/*
 * What this suite is for: an ending is added to Ironline's own public record, and the next
 * invoice is priced off the record afterwards rather than the record before. So it reads the
 * two figures a person reads — the score, and what the next invoice costs — and checks they
 * moved in the direction the ending earned. A screen that published the ending but went on
 * quoting the old price would pass every test in repay.spec.ts and fail these.
 */
test.describe('Ironline Freight — day 60 is written onto its public record', () => {
  /* Writing to a public testnet and reading it back is slower than a default test allows. */
  test.describe.configure({ timeout: 300_000 });

  test('the panel states what Ironline’s record says before anything is pressed', async ({
    page,
  }) => {
    await openReceivables(page);

    await expect(page.getByTestId('outcome-score-before')).toContainText(/\d{1,3} of 100/);
  });

  test('paying lifts the score on the record', async ({ page }) => {
    await openReceivables(page);
    const before = await number(page.getByTestId('outcome-score-before'));
    await press(page, 'Repay $50,000');

    expect(await number(page.getByTestId('outcome-score-after'))).toBeGreaterThan(before);
  });

  test('paying makes the next invoice cheaper than it was before day 60', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');

    const before = await number(page.getByTestId('outcome-discount-before'));
    const after = await number(page.getByTestId('outcome-discount-after'));

    expect(after).toBeLessThan(before);
  });

  test('pressing again reports what was already written down rather than recording it twice', async ({
    page,
  }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');
    const once = await number(page.getByTestId('outcome-score-after'));

    await page.getByRole('button', { name: 'Repay $50,000', exact: true }).click();
    await expect(page.getByTestId('repay-outcome')).toContainText(/already/i);

    expect(await number(page.getByTestId('outcome-score-after'))).toBe(once);
  });

  test('not paying drops the score on the record', async ({ page }) => {
    await openReceivables(page);
    const before = await number(page.getByTestId('outcome-score-before'));
    await press(page, 'Do not repay');

    expect(await number(page.getByTestId('outcome-score-after'))).toBeLessThan(before);
  });

  test('not paying makes the next invoice dearer than it was before day 60', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Do not repay');

    const before = await number(page.getByTestId('outcome-discount-before'));
    const after = await number(page.getByTestId('outcome-discount-after'));

    expect(after).toBeGreaterThan(before);
  });

  test('the panel says whether the record was published, and shows both sides either way', async ({
    page,
  }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');

    // Published or not, the business is told which. A tally worked out on the spot is worth
    // showing; one shown as though it were on the page is not.
    await expect(page.getByTestId('outcome-published')).toContainText(/published|not published/i);
    await expect(page.getByTestId('outcome-score-before')).toBeVisible();
    await expect(page.getByTestId('outcome-score-after')).toBeVisible();
  });
});
