import { expect, test, type Locator, type Page } from '@playwright/test';
import { BUSINESS, HASHSCAN, followOut, openDay60 } from '../portals.support';

/*
 * Day 60 moves money, and moving money takes as long as the network takes.
 *
 * Each ending mints what the payer is short, signs one transfer per holder and waits for each
 * to confirm on Hedera — round trips to a public network, which do not fit in Playwright's
 * default half minute. The wait is the point: what the panel reports is what confirmed, not
 * what was requested.
 *
 * Only the ending the demo shows is driven: Northwind pays, Ironline repays, both holders are
 * paid. The default is still in the product — the portal has a button for it — but a phase
 * with one step on the board should not spend two minutes proving a second one.
 */
test.describe.configure({ timeout: 300_000 });

/** What Ironline Freight owes at maturity, and what the division has to add up to. */
const FACE_VALUE_USD = 50_000;

/*
 * Walk Ironline to the receivable it owes on, and keep pressing until the section opens.
 *
 * The page is served before React has attached its handlers, so a first click can land on
 * markup that is not listening yet — silently. Retrying until the heading changes waits for the
 * portal to be usable rather than merely present. Nothing is recorded until this run records
 * it, so clearing whatever a previous press left behind starts every ending from the same day.
 */
async function openReceivables(page: Page) {
  await openDay60(page, BUSINESS);

  const again = page.getByTestId('repay-start-over');
  if (await again.isVisible()) await again.click();
}

/** The dollars in a cell, as a number, so amounts can be added up rather than matched. */
async function dollars(cell: Locator): Promise<number> {
  return Number((await cell.innerText()).replace(/[^0-9.]/g, ''));
}

/** Each holder's row, once the outcome is on screen. */
function holders(page: Page): Locator {
  return page.getByTestId('repay-holder');
}

async function press(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('repay-outcome')).toBeVisible({ timeout: 150_000 });
}

/*
 * On day 60 the repayment is divided across whoever the receivable says holds it, and both
 * endings are shown. So this reads the rows a person reads and checks that the parts add up to
 * the whole — a screen that paid one holder and told the other nothing would satisfy an
 * equality test on the first row and fail what is below.
 *
 * The money is mock USDC this repository deploys, because Circle's faucet hands out twenty
 * dollars every two hours and a $50,000 repayment can never be funded from it. So the paid
 * column is read as a record of what actually landed: an amount with no transaction behind it
 * is a claim, and the screen must not print one.
 */
test('Repay on day 60 and pay every holder its share', async ({ page }) => {
  /* Step 1 — the receivable states what is owed before anything is pressed. */
  await openReceivables(page);
  await expect(page.getByTestId('repay-owed')).toContainText('$50,000');

  /* Step 2 — repaying pays both holders, each named with what it holds. */
  await press(page, 'Repay $50,000');

  await expect(holders(page)).toHaveCount(2);
  await expect(holders(page).first()).toContainText('Woodgrove Capital');
  await expect(holders(page).nth(1)).toContainText('Bridgeline Partners');
  await expect(holders(page).first()).toContainText('units');

  /* Step 3 — each amount is that holder's share, and the shares add up to what was owed. */
  let total = 0;
  for (const row of await holders(page).all()) {
    const sharePct = await dollars(row.getByTestId('repay-holder-share'));
    const paid = await dollars(row.getByTestId('repay-holder-paid'));

    /* Within a dollar, which is the rounding the remainder rule hands to the largest holder. */
    expect(Math.abs(paid - (FACE_VALUE_USD * sharePct) / 100)).toBeLessThan(1);
    total += paid;
  }
  expect(total).toBe(FACE_VALUE_USD);

  /* Step 4 — every amount has a transaction behind it, in money this repository deploys. */
  await expect(page.getByTestId('repay-holder-hash')).toHaveCount(2);
  for (const hash of await page.getByTestId('repay-holder-hash').all()) {
    await expect(hash).toContainText(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/i);
  }

  /*
   * And each of those transactions is followed out to the chain from the row that names it.
   * A hash printed on our own screen is our own claim about a payment; the link is the part a
   * holder can check, so the link is the part that gets clicked.
   */
  const settled = await followOut(page, page.getByTestId('repay-holder-hash').first(), HASHSCAN);
  await settled.close();

  const money = page.getByTestId('repay-money');
  await expect(money).toContainText(/mock USDC/i);
  await expect(money).toContainText(/not\s+Circle/i);

  /* Step 5 — pressing again reports what was already recorded rather than paying twice. */
  await page.getByRole('button', { name: 'Repay $50,000', exact: true }).click();
  await expect(page.getByTestId('repay-outcome')).toContainText(/already/i);
});
