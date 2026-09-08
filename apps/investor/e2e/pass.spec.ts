import { expect, test, type Page } from '@playwright/test';
import deployed from '@rf/contracts-ens/deployed.json';

/*
 * What a judge is asked to believe is that the fund's own screen is reporting the chain, not a
 * number typed into the repo. So the expected values are taken from what onboarding recorded
 * on Sepolia, and the test fails if the page disagrees with it.
 */
const onchain = deployed as { investor?: { name: string; wallet: string; expiresAt: string } };

/*
 * The page is server-rendered, so the Compliance button exists and is clickable a moment
 * before React has attached its handler. Retrying the click until the section actually changes
 * is what makes the run stable — waiting on a fixed timer would only move the flake.
 */
async function openCompliance(page: Page) {
  await page.goto('/');
  await expect(async () => {
    await page.getByRole('button', { name: 'Compliance' }).click();
    await expect(page.getByRole('heading', { name: 'Eligibility pass' })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });

  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Eligibility pass' }) })
    .first();
}

test.describe('the fund sees the pass it holds', () => {
  test.skip(!onchain.investor, 'nothing onboarded yet — run the ENS onboarding script first');

  test('shows the name, wallet and expiry that are on chain', async ({ page }) => {
    const pass = await openCompliance(page);
    const expiresOn = new Date(Number(onchain.investor!.expiresAt) * 1000).toISOString().slice(0, 10);

    await expect(pass).toContainText(onchain.investor!.name);
    await expect(pass).toContainText(onchain.investor!.wallet);
    await expect(pass).toContainText(expiresOn);
  });

  test('reports the fund as cleared while the expiry is still ahead', async ({ page }) => {
    const pass = await openCompliance(page);
    const ahead = Number(onchain.investor!.expiresAt) * 1000 > Date.now();

    await expect(pass).toContainText(ahead ? 'Valid' : 'Lapsed');
  });

  test('quotes the same expiry in the transfer log as on the pass', async ({ page }) => {
    const pass = await openCompliance(page);
    const expiresOn = new Date(Number(onchain.investor!.expiresAt) * 1000).toISOString().slice(0, 10);
    const log = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Transfer log — checked at the moment of purchase' }) })
      .first();

    // The log claims the transfer was checked against this pass, so quoting a different date
    // would be the screen disagreeing with itself as well as with the registry.
    await expect(pass).toContainText(expiresOn);
    await expect(log).toContainText(expiresOn);
  });
});
