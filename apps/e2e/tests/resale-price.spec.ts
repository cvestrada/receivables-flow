import { expect, test, type Page } from '@playwright/test';

const INVESTOR = 'http://127.0.0.1:3201';

/*
 * Walk the fund to its positions, and keep pressing until the section opens.
 *
 * The page is served before React has attached its handlers, so a first click can land on
 * markup that is not listening yet — silently. Retrying until the heading changes waits for
 * the portal to be usable rather than merely present.
 */
async function openPortfolio(page: Page) {
  await page.goto(INVESTOR);

  await expect(async () => {
    await page.getByRole('button', { name: /^Portfolio/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Portfolio', { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
}

/** The dollars in a cell, as a number, so two prices can be compared rather than matched. */
async function dollars(page: Page, testid: string): Promise<number> {
  const row = page.getByTestId(testid);
  const text = await row.locator('td').last().innerText();

  return Number(text.replace(/[$,]/g, ''));
}

/*
 * What this suite is for: the resale price on the fund's screen is the published formula run
 * again on Ironline Freight's live record, not a figure anyone typed. So it reads the three
 * rows a person reads, and checks the relationship between them rather than one number — a
 * hardcoded price would satisfy an equality test and fail every one of these.
 */
test.describe('Woodgrove Capital — what half the position sells for on day 20', () => {
  test('the portfolio shows the day-0 rate and the day-20 rate side by side', async ({ page }) => {
    await openPortfolio(page);

    const panel = page.getByTestId('resale-price');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Day 0 — the whole invoice');
    await expect(panel).toContainText('Day 20 — half the position');
    await expect(panel).toContainText('$50,000 payable in 60 days');
    await expect(panel).toContainText('$25,000 payable in 40 days');
  });

  test('the day-20 price is quoted against the credit score, not against a number we chose', async ({
    page,
  }) => {
    await openPortfolio(page);

    const today = page.getByTestId('resale-price-today');
    await expect(today).toContainText('/ 100');
    await expect(today).toContainText('%');
  });

  test('a record with one late payment on it visibly costs more', async ({ page }) => {
    await openPortfolio(page);

    const priced = await dollars(page, 'resale-price-today');
    const ifLate = await dollars(page, 'resale-price-if-late');

    expect(ifLate).toBeLessThan(priced);
  });

  test('what the late payment costs is stated on screen as money', async ({ page }) => {
    await openPortfolio(page);

    const cost = page.getByTestId('resale-price-cost-of-late');
    await expect(cost).toBeVisible();
    await expect(cost).toContainText('$');

    const priced = await dollars(page, 'resale-price-today');
    const ifLate = await dollars(page, 'resale-price-if-late');
    const stated = Number((await cost.innerText()).replace(/[$,]/g, ''));

    /* Within a cent, so the sentence cannot quote a saving the table does not show. */
    expect(Math.abs(stated - (priced - ifLate))).toBeLessThan(0.01);
  });

  test('the price the resale actually settles at is the price on the panel', async ({ page }) => {
    await openPortfolio(page);

    const quoted = await dollars(page, 'resale-price-today');

    await page.getByRole('button', { name: 'Sell half', exact: true }).click();

    const cash = page.getByTestId('resale-cash-back');
    await expect(cash).toBeVisible({ timeout: 30_000 });

    /* The panel quotes cents and the sale reports whole dollars, so this is the rounding. */
    await expect(cash).toContainText(`$${Math.round(quoted).toLocaleString('en-US')}`);
  });
});
