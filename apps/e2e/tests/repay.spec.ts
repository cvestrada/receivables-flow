import { expect, test, type Locator, type Page } from '@playwright/test';

const BUSINESS = 'http://127.0.0.1:3200';

/*
 * Day 60 now moves money, and moving money takes as long as the network takes.
 *
 * Each ending mints what the payer is short, signs one transfer per holder and waits for each
 * to confirm on Hedera, then writes the outcome onto Ironline's record on Sepolia — four
 * round trips to two public networks, which do not fit in Playwright's default half minute.
 * The wait is the point: what the panel reports is what confirmed, not what was requested.
 */
test.describe.configure({ timeout: 180_000 });

/** What Ironline Freight owes at maturity, and what the division has to add up to. */
const FACE_VALUE_USD = 50_000;

/*
 * Walk Ironline to the receivable it owes on, and keep pressing until the section opens.
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

  /* Nothing is recorded until this run records it, so every test starts from the same day 60. */
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
 * What this suite is for: on day 60 the repayment is divided across whoever the receivable says
 * holds it, and both endings are shown. So it reads the rows a person reads and checks that the
 * parts add up to the whole — a screen that paid one holder and told the other nothing would
 * satisfy an equality test on the first row and fail every one of these.
 */
test.describe('Ironline Freight — repaying on day 60, and not repaying', () => {
  test('the receivable states what is owed at maturity before anything is pressed', async ({
    page,
  }) => {
    await openReceivables(page);

    await expect(page.getByTestId('repay-owed')).toContainText('$50,000');
  });

  test('repaying pays both holders, each named with what it holds', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');

    await expect(holders(page)).toHaveCount(2);
    await expect(holders(page).first()).toContainText('Woodgrove Capital');
    await expect(holders(page).nth(1)).toContainText('Bridgeline Partners');
    await expect(holders(page).first()).toContainText('units');
  });

  test('each amount paid is that holder’s share of the $50,000', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');

    for (const row of await holders(page).all()) {
      const sharePct = await dollars(row.getByTestId('repay-holder-share'));
      const paid = await dollars(row.getByTestId('repay-holder-paid'));

      /* Within a dollar, which is the rounding the remainder rule hands to the largest holder. */
      expect(Math.abs(paid - (FACE_VALUE_USD * sharePct) / 100)).toBeLessThan(1);
    }
  });

  test('what the holders were paid adds up to what was owed', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');

    let total = 0;
    for (const row of await holders(page).all()) {
      total += await dollars(row.getByTestId('repay-holder-paid'));
    }

    expect(total).toBe(FACE_VALUE_USD);
  });

  test('repaying a second time reports what was already recorded rather than paying again', async ({
    page,
  }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');
    await page.getByRole('button', { name: 'Repay $50,000', exact: true }).click();

    await expect(page.getByTestId('repay-outcome')).toContainText(/already/i);

    let total = 0;
    for (const row of await holders(page).all()) {
      total += await dollars(row.getByTestId('repay-holder-paid'));
    }

    expect(total).toBe(FACE_VALUE_USD);
  });

  test('not repaying marks the receivable defaulted', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Do not repay');

    await expect(page.getByTestId('repay-outcome')).toContainText(/defaulted/i);
  });

  test('each holder’s loss is stated in the same proportion its payment would have been', async ({
    page,
  }) => {
    await openReceivables(page);
    await press(page, 'Do not repay');

    for (const row of await holders(page).all()) {
      const sharePct = await dollars(row.getByTestId('repay-holder-share'));
      const lost = await dollars(row.getByTestId('repay-holder-lost'));

      expect(Math.abs(lost - (FACE_VALUE_USD * sharePct) / 100)).toBeLessThan(1);
    }
  });

  test('nobody is shown as having been paid anything', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Do not repay');

    /* Not nought in a paid column — no paid column at all. Nothing was divided up to pay with. */
    await expect(page.getByTestId('repay-holder-paid')).toHaveCount(0);
  });
});

/*
 * What this suite is for: the money on day 60 is mock USDC this repository deploys, because
 * Circle's faucet hands out twenty dollars every two hours and a $50,000 repayment can never be
 * funded from it. So these read the paid column as a record of what actually landed — an amount
 * with no transaction behind it is a claim, and the screen must not print one.
 */
test.describe('Ironline Freight — paid in mock USDC, not Circle’s', () => {
  test('every holder paid shows the transaction that paid it', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');

    const paid = page.getByTestId('repay-holder-paid');
    await expect(paid).toHaveCount(2);
    await expect(page.getByTestId('repay-holder-hash')).toHaveCount(2);

    for (const hash of await page.getByTestId('repay-holder-hash').all()) {
      await expect(hash).toContainText(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/i);
    }
  });

  test('no holder is shown a paid amount without a transaction behind it', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');

    const paid = await page.getByTestId('repay-holder-paid').count();
    const hashes = await page.getByTestId('repay-holder-hash').count();

    expect(paid).toBe(hashes);

    /* Nothing moved is a fine outcome, as long as the screen says so instead of showing amounts. */
    if (paid === 0) await expect(page.getByTestId('repay-reason')).toBeVisible();
  });

  test('the panel names the money as mock USDC this repository deploys', async ({ page }) => {
    await openReceivables(page);
    await press(page, 'Repay $50,000');

    const money = page.getByTestId('repay-money');
    await expect(money).toContainText(/mock USDC/i);
    await expect(money).toContainText(/not\s+Circle/i);
  });
});
