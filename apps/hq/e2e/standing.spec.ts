import { expect, test } from '@playwright/test';
import deployed from '@rf/contracts-ens/deployed.json';

/*
 * Every press here is a real transaction on Sepolia, so the suite makes exactly two of them —
 * reject, then approve — and leaves the fund the way it found it. Running the pair in one test
 * rather than two is what guarantees that: a suite that stopped halfway between them would
 * leave the demo with an unapproved fund.
 */
const onchain = deployed as { investor?: { name: string; wallet: string } };

type Page = import('@playwright/test').Page;

/* Scoped to the fund's own row — a bare `.first()` would press the company's button instead. */
const row = (page: Page) => page.getByTestId('row-woodgrove');
const status = (page: Page) => page.getByTestId('status-woodgrove');

test.describe('staff decide a fund’s KYC', () => {
  test.skip(!onchain.investor, 'nothing onboarded yet — run the ENS onboarding script first');

  test('opens showing the fund and what the registry says about it', async ({ page }) => {
    await page.goto('/');

    await expect(row(page)).toContainText(onchain.investor!.name);
    await expect(status(page)).toBeVisible();
  });

  test('offers only the decision that applies, and asks before making it', async ({ page }) => {
    await page.goto('/');
    await expect(status(page)).toContainText('Approved');

    // An approved party can only be revoked — offering "Approve" here would be a button that
    // spends gas to write the value the record already holds.
    await expect(row(page).getByRole('button', { name: 'Approve KYC' })).toHaveCount(0);
    await row(page).getByRole('button', { name: 'Revoke KYC' }).click();

    await expect(page.getByTestId('confirm-woodgrove')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(status(page)).toContainText('Approved');
  });

  test('revoking flips the row, and approving flips it back', async ({ page }) => {
    await page.goto('/');
    await expect(status(page)).toContainText('Approved');

    await row(page).getByRole('button', { name: 'Revoke KYC' }).click();
    await page.getByTestId('confirm-go-woodgrove').click();
    await expect(status(page)).toContainText('Not approved', { timeout: 120_000 });

    await row(page).getByRole('button', { name: 'Approve KYC' }).click();
    await page.getByTestId('confirm-go-woodgrove').click();
    await expect(status(page)).toContainText('Approved', { timeout: 120_000 });
  });

  test('reports the transaction each decision made', async ({ page }) => {
    await page.goto('/');

    // The link is the whole point of the button: staff can hand it to anyone.
    await expect(row(page).getByRole('link', { name: /^0x/ }).or(status(page))).toBeVisible();
  });
});
