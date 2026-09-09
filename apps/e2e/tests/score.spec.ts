import { expect, test, type Page } from '@playwright/test';

const INVESTOR = 'http://127.0.0.1:3201';

/** A score as the portal states it — a share of matured invoices, never a letter. */
const OUT_OF_100 = /\d{1,3} of 100/;

/*
 * Walk the fund to the moment the offer is on the table.
 *
 * The portal opens on a later day, so the stage has to be chosen before the section: the
 * marketplace is empty on every other day and an assertion there would pass or fail for the
 * wrong reason. Both clicks retry because the page is served before React attaches, and a
 * first click can land on markup that is not listening yet.
 */
async function openOffer(page: Page) {
  await page.goto(INVESTOR);

  await expect(async () => {
    await page.getByRole('button', { name: 'Day 1 Issued' }).click();
    await page.getByRole('button', { name: /^Marketplace/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marketplace', {
      timeout: 1000,
    });
  }).toPass({ timeout: 30_000 });
}

test.describe('Woodgrove Capital — the offer carries a score, not a grade', () => {
  test('the fund reads a credit score out of 100 on the offer itself', async ({ page }) => {
    await openOffer(page);

    const offers = page.getByRole('table').first();
    await expect(offers).toContainText('Credit score');
    await expect(offers).toContainText('Ironline Freight');
    await expect(offers).toContainText(OUT_OF_100);
  });

  test('no letter grade survives anywhere on the market screen', async ({ page }) => {
    await openOffer(page);

    // The screen used to say "tier B" in four places. A letter needs band cutoffs somebody
    // chose, which is the judgment this product exists to remove — so none may come back.
    await expect(page.locator('main')).not.toContainText(/tier\s+[A-D]/i);
    await expect(page.getByRole('columnheader', { name: 'Tier', exact: true })).toHaveCount(0);
  });

  test('the mandate floor the fund enforces is a number too', async ({ page }) => {
    await page.goto(INVESTOR);

    // The mandate is shown on the days before the fund has allocated. On later days the
    // compliance section is the transfer log instead, so the day has to be chosen first.
    await expect(async () => {
      await page.getByRole('button', { name: 'Day 1 Issued' }).click();
      await page.getByRole('button', { name: /^Compliance/ }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compliance', {
        timeout: 1000,
      });
    }).toPass({ timeout: 30_000 });

    const compliance = page.locator('main');
    await expect(compliance).toContainText('Minimum credit score');
    await expect(compliance).toContainText(OUT_OF_100);
    await expect(compliance).not.toContainText('Minimum credit tier');
  });
});
