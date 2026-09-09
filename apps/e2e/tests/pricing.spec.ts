import { expect, test, type Page } from '@playwright/test';

const BUSINESS = 'http://127.0.0.1:3200';

/*
 * Open a section, and keep pressing until it opens.
 *
 * The page is served before React has attached its handlers, so the first click can land on
 * markup that is not listening yet. Retrying until the heading changes waits for the app to be
 * usable rather than merely present.
 */
async function openSection(page: Page, url: string, label: string) {
  await page.goto(url);

  await expect(async () => {
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
}

/*
 * These assert what a viewer can see, not what a library returns. The claim being checked is
 * that the price on Ironline Freight's screen is worked out from its public record — so the
 * test reads the same three lines a person would, in the order they would read them.
 */
test.describe('Ironline Freight — the price is a sum on screen, not a number we typed', () => {
  test('the quote shows the repayment record it was priced from', async ({ page }) => {
    await openSection(page, BUSINESS, 'Receivables');

    const quote = page.getByTestId('quote');
    await expect(quote).toBeVisible();
    await expect(quote).toContainText('Repayment record');
    await expect(quote).toContainText('Credit score');
  });

  test('a spotless record earns the best rate and $47,500 today', async ({ page }) => {
    await openSection(page, BUSINESS, 'Receivables');

    const quote = page.getByTestId('quote');
    await expect(quote).toContainText('100 / 100');
    await expect(quote).toContainText('30.00%');
    await expect(page.getByTestId('quote-proceeds')).toHaveText('$47,500');
  });

  test('the discount is shown as the step between face value and proceeds', async ({ page }) => {
    await openSection(page, BUSINESS, 'Receivables');

    const quote = page.getByTestId('quote');
    await expect(quote).toContainText('$50,000');
    await expect(quote).toContainText('− $2,500');
  });

  test('the day-60 repayment is shown as already booked with the sale', async ({ page }) => {
    await openSection(page, BUSINESS, 'Receivables');

    const booked = page.getByTestId('booked-repayment');
    await expect(booked).toBeVisible();
    await expect(booked).toContainText('booked with the sale');
    await expect(booked).toContainText('Hedera schedule service');
  });
});
