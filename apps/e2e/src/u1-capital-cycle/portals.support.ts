import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The three screens one capital cycle runs across, and the two ways of getting into one.
 *
 * Every goal in this journey opens a portal and clicks into a section, and each spec used to
 * carry its own copy of that. One copy here instead: when a sidebar label changes, the suite
 * should need one edit, not nine.
 */

/** Ironline Freight's portal — raising, approving, issuing, and day 60. */
export const BUSINESS = 'http://127.0.0.1:3200';

/** Woodgrove Capital's portal — the mandate, the market, the position, the exit. */
export const INVESTOR = 'http://127.0.0.1:3201';

/*
 * The staff portal on 3202 is not driven by this suite any more.
 *
 * Approving a party is how a name and its standing come to exist, but it happens once, before
 * any of this, and staging it as a step meant showing a company with a payment history and no
 * approval — a state that cannot exist. The record it produces is asserted where it is used:
 * in the price, in the refusal, and in what day 60 writes back.
 */

/*
 * The same two portals, built with the Privy app id left in so their sign-in gates render.
 *
 * Every other spec drives the pair above, which open straight onto the dashboard — that is the
 * portal a judge can look at without an account. Onboarding is the one phase where signing in
 * is the thing being demonstrated, so it drives these.
 */
export const BUSINESS_SIGNED_IN = 'http://127.0.0.1:3210';
export const INVESTOR_SIGNED_IN = 'http://127.0.0.1:3211';

/** Every tab either portal has, by the label on its sidebar entry. */
const ROUTES: Record<string, { route: string; heading: string }> = {
  Invoices: { route: '/invoices/outstanding', heading: 'Invoices' },
  Financed: { route: '/invoices/financed', heading: 'Invoices' },
  Approvals: { route: '/approvals', heading: 'Approvals' },
  Offered: { route: '/portfolio/offered', heading: 'Portfolio' },
  Held: { route: '/portfolio/held', heading: 'Portfolio' },
  Mandate: { route: '/mandate', heading: 'Mandate' },
};

/**
 * Open a portal's section.
 *
 * Each tab is its own route now, so this navigates rather than clicking: a click would be
 * testing that the sidebar link works — which it is worth doing once, not in every spec — while
 * what these specs are about is what the tab then says. Waiting on the heading is what waits
 * for the page to be usable rather than merely served.
 *
 * @param page - The browser page
 * @param url - Which portal
 * @param label - The section's own sidebar label, which is also its heading
 */
export async function openSection(page: Page, url: string, label: string): Promise<void> {
  const tab = ROUTES[label];
  if (!tab) throw new Error(`${label} is not a tab on either portal`);

  await page.goto(`${url}${tab.route}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(tab.heading, { timeout: 30_000 });
}

/**
 * The six phases of the capital cycle, in the order both portals walk them.
 *
 * The demo timeline strip is gone — it was a second account of where the deal had got to and
 * nothing updated it when a person acted. The stops themselves remain, reached with the arrow
 * keys, which is what a walkthrough uses and what a test can drive.
 */
export const PHASES = [
  'Sign In Both Sides',
  'Source Invoice',
  'Fund Invoice',
  'Sell Part To Another Investor',
  'Collect Repayment',
  'Reprice The Capital Cost',
] as const;

/**
 * Open a section at a particular phase of the cycle.
 *
 * Several sections say different things at different phases — the fund's portfolio is empty at
 * every phase but the one the offer is live, and its mandate becomes a transfer log once it has
 * allocated. Choosing the phase first is what keeps an assertion from passing for the wrong
 * reason. Both portals open on the first phase, so this walks forward from there.
 *
 * @param page - The browser page
 * @param url - Which portal
 * @param phase - The phase's own name, one of {@link PHASES}
 * @param label - The section's own sidebar label
 */
export async function openSectionOnDay(
  page: Page,
  url: string,
  phase: (typeof PHASES)[number] | string,
  label: string,
): Promise<void> {
  const step = PHASES.indexOf(phase as (typeof PHASES)[number]);
  if (step < 0) throw new Error(`${phase} is not one of the cycle's phases`);

  await openSection(page, url, label);

  for (let i = 0; i < step; i += 1) await page.keyboard.press('ArrowRight');
}

/**
 * Put Ironline's invoice back to un-submitted, so a run starts where the demo starts.
 *
 * Submitting is a thing that happened and it survives between runs on purpose. A suite that did
 * not clear it would find the request already on the Approvals section and never see the state
 * before one exists.
 *
 * @param page - The browser page, for its request context
 * @param url - The business portal to forget it on
 */
export async function forgetSubmission(page: Page, url: string): Promise<void> {
  const cleared = await page.request.delete(`${url}/api/invoice`);
  expect(cleared.ok()).toBe(true);
}

/**
 * Put the whole demo back to its first screen, the way the button in the sidebar does.
 *
 * Three files forgotten, Ironline's ENS counts rewritten, the receivable's units redeemed so it
 * can be minted again. It is the state a judge starts from, so it is the state the phase that
 * mints starts from. About a minute, because two of those are transactions.
 *
 * @param page - The browser page, for its request context
 * @param url - The business portal
 */
export async function resetDemo(page: Page, url: string): Promise<void> {
  const reset = await page.request.post(`${url}/api/demo`, { timeout: 180_000 });
  expect(reset.ok()).toBe(true);
}

/**
 * Put the demo in the state where the receivable exists, without minting one.
 *
 * Day 60, the resale and the repayment all follow the mint, and the mint takes two real
 * signatures — one of which is a person in a browser. A spec about what happens *after*
 * issuance should not have to perform the issuance, so it records the outcome the same way the
 * wizard does and gets on with what it is actually asserting.
 *
 * @param page - The browser page, for its request context
 * @param url - The business portal
 */
export async function markTokenized(page: Page, url: string): Promise<void> {
  /*
   * A fresh one each time. Recording the mint counts the invoice as financed on Ironline's
   * page, and day 60 refuses to end an invoice that was never counted — so a phase about day 60
   * starts by forgetting the last invoice and recording a new one, which is what keeps the
   * counts adding up across runs.
   */
  await page.request.delete(`${url}/api/invoice`);
  await page.request.delete(`${url}/api/repay`).catch(() => undefined);

  const recorded = await page.request.post(`${url}/api/invoice`, {
    data: { action: 'tokenized', hash: `0x${Date.now().toString(16).padStart(64, 'a')}` },
    timeout: 120_000,
  });
  expect(recorded.ok()).toBe(true);
}

/**
 * Open the business's Invoices section on what has been financed.
 *
 * The price, the receivable and day 60 all live under **Financed**, and none of them render for
 * an invoice that was never minted — which is the ordering the portal now enforces.
 *
 * @param page - The browser page
 * @param url - Which business portal
 */
export async function openFinanced(page: Page, url: string): Promise<void> {
  await markTokenized(page, url);

  await page.goto(`${url}/invoices/financed`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Invoices', { timeout: 30_000 });
  await expect(page.getByTestId('financed-term')).toBeVisible({ timeout: 15_000 });
}

/**
 * Open Financed, and unfold the day-60 panel inside it.
 *
 * Day 60 is folded away by default: it is the least urgent thing on that screen for fifty-nine
 * of the sixty days, and leaving it open made a page about what an invoice cost end in a table
 * about who gets paid. A test that is about day 60 opens it, the way a person would.
 *
 * @param page - The browser page
 * @param url - Which business portal
 */
export async function openDay60(page: Page, url: string): Promise<void> {
  await openFinanced(page, url);

  await page.getByRole('button', { name: /repayment/i }).click();
  await expect(page.getByTestId('repay-owed')).toBeVisible({ timeout: 30_000 });
}

/**
 * Follow a link out of the portal, the way a person does, and check where it lands.
 *
 * Clicked rather than navigated to. A test that types a HashScan url proves only that HashScan
 * exists; what has to be proved is that the screen a judge is looking at will take them there —
 * so the click happens on our own markup, the tab that opens is a real tab in the same context,
 * and the trace carries both.
 *
 * @param page - The page holding the link
 * @param link - The link to press
 * @param host - The host the new tab must land on
 * @returns The opened page, still open, so the caller can assert what is on it
 */
export async function followOut(page: Page, link: Locator, host: string) {
  const [opened] = await Promise.all([page.context().waitForEvent('page'), link.click()]);

  await opened.waitForLoadState('domcontentloaded');
  expect(new URL(opened.url()).host).toContain(host);

  return opened;
}

/** Where the chain shows what happened, for anyone who does not take the portal's word for it. */
export const HASHSCAN = 'hashscan.io';

/**
 * Where a stranger reads the record, with no portal of ours in the way.
 *
 * ENS's own deployment explorer for this hackathon's registry. A test that only ever proved a
 * record by reading our screen would be proving our screen.
 */
export const ENS_PORTAL = 'https://hackathon-deployment-portal-app.ens-cf.workers.dev';
