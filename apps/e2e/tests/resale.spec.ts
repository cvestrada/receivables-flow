import { expect, test, type Page } from '@playwright/test';

const INVESTOR = 'http://127.0.0.1:3201';

/*
 * Whether the fund can actually sign on Hedera decides what a refusal is allowed to say, not
 * whether the flow works. Without keys, pressing the button must still come back with the
 * reason the sale could not happen; with them, that reason has to be the receivable turning
 * the buyer away. Same click, same wiring — only the wording of the answer is conditional.
 */
const PROVISIONED = Boolean(process.env.HEDERA_OPERATOR_KEY);

/*
 * Walk the fund to its own positions, and keep pressing until the section opens.
 *
 * The page is served before React has attached its handlers, so a first click can land on
 * markup that is not listening yet — silently. Retrying until the heading changes waits for
 * the portal to be usable rather than merely present. The sidebar entry is matched on its
 * label alone because it carries a position count beside it.
 */
async function openPortfolio(page: Page) {
  await page.goto(INVESTOR);

  await expect(async () => {
    await page.getByRole('button', { name: /^Portfolio/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Portfolio', { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
}

test.describe('Woodgrove Capital — selling half the position on day 20', () => {
  test('the portfolio section shows a Sell half action on the held position', async ({ page }) => {
    await openPortfolio(page);

    const panel = page.getByRole('region', { name: 'Sell half of RCV-0001' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('RCV-0001');
    await expect(panel.getByRole('button', { name: 'Sell half', exact: true })).toBeVisible();
  });

  test('clicking Sell half leaves two holders on screen, each with its share', async ({ page }) => {
    await openPortfolio(page);

    await page.getByRole('button', { name: 'Sell half', exact: true }).click();

    const split = page.getByTestId('resale-split');
    await expect(split).toBeVisible({ timeout: 30_000 });
    await expect(split).toContainText('Woodgrove Capital');
    await expect(split).toContainText('Harbour Lane Partners');
    await expect(split.getByText('50.00%')).toHaveCount(2);
  });

  test('the cash returned to the fund appears on screen after the sale', async ({ page }) => {
    await openPortfolio(page);

    await page.getByRole('button', { name: 'Sell half', exact: true }).click();

    const cash = page.getByTestId('resale-cash-back');
    await expect(cash).toBeVisible({ timeout: 30_000 });
    await expect(cash).toContainText('$24,150');
  });

  test("a purchase by a wallet with no eligibility pass is refused on screen, showing the chain's reason", async ({
    page,
  }) => {
    await openPortfolio(page);

    await page.getByRole('button', { name: 'Sell half to a wallet with no pass' }).click();

    const refusal = page.getByTestId('resale-refusal');
    await expect(refusal).toBeVisible({ timeout: 30_000 });
    await expect(refusal).toContainText('No units moved and no money moved.');
    await expect(refusal).toContainText(PROVISIONED ? 'Refused by the receivable.' : 'not open yet');

    /* The reason is repeated word for word, so the screen cannot claim a refusal it did not get. */
    await expect(page.getByTestId('resale-reason')).not.toBeEmpty();
    await expect(refusal).not.toContainText('Settled.');
  });
});
