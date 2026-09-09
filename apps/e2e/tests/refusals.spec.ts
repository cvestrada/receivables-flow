import { expect, test, type Page } from '@playwright/test';

const BUSINESS = 'http://127.0.0.1:3200';
const INVESTOR = 'http://127.0.0.1:3201';

/*
 * Whether the accounts are open decides what a refusal is allowed to say, not
 * whether the flow works. Unprovisioned, pressing Send must still reach the
 * company account and come back with the reason it could not act; provisioned,
 * that reason must be Privy declining to sign. Both are the same click and the
 * same wiring — so the flow is asserted either way, and only the wording of the
 * answer is conditional.
 */
const PROVISIONED = Boolean(process.env.PRIVY_APP_SECRET);

/*
 * Open a section, and keep pressing until it opens.
 *
 * The page is served before React has attached its handlers, so the first click can
 * land on markup that is not listening yet — silently, with the button taking focus
 * and nothing else happening. Retrying until the heading changes waits for the app
 * to be usable rather than merely present. The sidebar entry is matched on its label
 * alone because it carries a pending count that other tests here move.
 */
async function openSection(page: Page, url: string, label: string) {
  await page.goto(url);

  await expect(async () => {
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
}

test.describe('Ironline Freight — one approval does not issue the receivable', () => {
  test('the Approvals section counts approvals rather than describing them', async ({ page }) => {
    await openSection(page, BUSINESS, 'Approvals');

    const panel = page.getByRole('region', { name: 'Issue this receivable' });
    await expect(panel).toContainText('INV-2026-0417');
    await expect(panel).toContainText('$50,000');
    await expect(panel).toContainText('0 of 2 approved');
    await expect(panel).toContainText('Nobody has approved yet.');
  });

  test('sending with too few approvals comes back refused, not sold', async ({ page }) => {
    await openSection(page, BUSINESS, 'Approvals');

    await page.getByRole('button', { name: 'Send to the company account' }).click();

    const panel = page.getByRole('region', { name: 'Issue this receivable' });
    await expect(panel).toContainText(PROVISIONED ? 'Refused by Privy.' : 'not open yet', {
      timeout: 20_000,
    });
    await expect(panel).not.toContainText('Issued.');
  });

  test('the portal no longer describes an office manager with a $10,000 limit', async ({ page }) => {
    await openSection(page, BUSINESS, 'Approvals');

    await expect(page.getByText('Office manager')).toHaveCount(0);
    await expect(page.getByText('Anna Reed · Tom Hill · Grace Ward')).toBeVisible();
  });
});

test.describe('Woodgrove Capital — the mandate refuses on screen', () => {
  test('an allocation over the cap will not sign', async ({ page }) => {
    await openSection(page, INVESTOR, 'Compliance');

    await page.getByRole('button', { name: /Allocate \$150,000/ }).click();

    const panel = page.getByRole('region', { name: 'Allocate into RCV-0001' });
    await expect(panel).toContainText(PROVISIONED ? 'Will not sign.' : 'not open yet', {
      timeout: 20_000,
    });
    await expect(panel).not.toContainText('Signed and sent.');
  });

  test('an allocation into an unrated invoice will not sign', async ({ page }) => {
    await openSection(page, INVESTOR, 'Compliance');

    await page.getByRole('button', { name: 'Allocate into an unrated invoice' }).click();

    const panel = page.getByRole('region', { name: 'Allocate into RCV-0001' });
    await expect(panel).toContainText(PROVISIONED ? 'Will not sign.' : 'not open yet', {
      timeout: 20_000,
    });
    await expect(panel).not.toContainText('Signed and sent.');
  });

  test('an allocation within the mandate is signed and sent', async ({ page }) => {
    test.skip(!PROVISIONED, 'the fund account has not been opened yet');
    await openSection(page, INVESTOR, 'Compliance');

    await page.getByRole('button', { name: /Allocate \$47,500/ }).click();

    const panel = page.getByRole('region', { name: 'Allocate into RCV-0001' });
    await expect(panel).toContainText('Signed and sent.', { timeout: 30_000 });
  });
});
