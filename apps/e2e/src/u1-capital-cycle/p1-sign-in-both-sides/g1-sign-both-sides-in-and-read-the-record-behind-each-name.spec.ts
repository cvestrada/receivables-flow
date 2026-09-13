import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import { BUSINESS_SIGNED_IN, INVESTOR_SIGNED_IN } from '../portals.support';
import { signInCredentials, waitForSignInCode } from '../otp.support';

/*
 * The deployment record is pulled through `createRequire` rather than imported: this package is
 * ESM, and a bare JSON import there needs an import attribute Playwright's own loader does not
 * hand it. One require is less machinery than teaching the loader about JSON.
 */
const onchain = createRequire(import.meta.url)('@rf/contracts-ens/deployed.json') as {
  business?: { name: string };
  investor?: { name: string };
};

/** The director's address, and the Resend key that can read what Privy sends to it. */
const credentials = signInCredentials();

/**
 * The fund signs in as itself, on the same inbound domain the directors use.
 *
 * Overridable because the address only has to be one Privy will email and Resend will receive —
 * nothing about it is registered anywhere in advance.
 */
const FUND_EMAIL =
  process.env.E2E_FUND_EMAIL ?? credentials?.email.replace(/^[^@]+/, 'inv-woodgrove') ?? '';

/**
 * Sign in to a portal the way a person does: press the button, give Privy an address, and type
 * the six digits it emails back.
 *
 * The modal is Privy's own markup, so it is driven by what a person reads — the address field,
 * the button beside it — rather than by test ids we do not own. The code is read out of the
 * Resend inbox that address belongs to, and only mail that arrived after the address was
 * submitted counts: the same inbox holds older codes, all six digits, all looking right.
 */
async function signIn(page: Page, url: string, email: string, key: string): Promise<void> {
  await page.goto(url);
  await page.getByRole('button', { name: 'Sign in' }).click();

  const address = page.getByPlaceholder(/email/i).or(page.getByRole('textbox').first());
  await expect(address).toBeVisible({ timeout: 30_000 });
  await address.fill(email);

  const sentAt = Date.now();
  await page.getByRole('button', { name: /submit|continue|next/i }).first().click();

  const code = await waitForSignInCode(email, sentAt, key);

  /*
   * Privy renders the code as six boxes and distributes what is typed into the first of them.
   * Filling each box by index would be testing our idea of their markup instead of using it.
   */
  await page.getByRole('textbox').first().click();
  await page.keyboard.type(code, { delay: 60 });

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
}

/**
 * Open the name in the topbar, read the wallet behind it, and follow it out to the record.
 *
 * The name is a chip that opens onto two things: the account it stands for, shortened to
 * something a person can compare at a glance, and a link to the record itself. Both are the
 * point of putting an identity on ENS — a name with no address behind it is a label, and an
 * address nobody can read the history of is a number.
 *
 * The link opens a real new tab in the same context, the way it does for a person, so the trace
 * carries it. The page it opens is the text records themselves: the counts the price is worked
 * out from, readable without asking us for anything.
 */
async function readRecord(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name }).click();

  /* The account the name stands for — shortened on screen, whole in the title. */
  const wallet = page.getByTestId('identity-wallet');
  await expect(wallet).toBeVisible();
  await expect(wallet).toContainText('0x');

  const [record] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('link', { name: /Open on ENS/ }).click(),
  ]);

  await record.waitForLoadState('domcontentloaded');
  expect(record.url()).toContain(name);
  expect(record.url()).toContain('/records');

  await expect(record.locator('body')).toContainText('rf.', { timeout: 60_000 });

  await record.close();
}

/*
 * Onboarding: two sign-ins, and the records behind the two names.
 *
 * Both sides sign in for real — Privy's own modal, a code emailed to an address that really
 * receives mail, no mocked inbox anywhere — because "no extension, no seed phrase" is the claim
 * being made, and a suite that skipped the sign-in asserted everything except the claim. Every
 * other spec runs the portals with Privy switched off, which is the version a judge can open
 * without an account; this one runs the two built with it on.
 *
 * Then each portal's name is opened on the ENS explorer, because that is the whole argument for
 * putting an identity there: the company's payment history and the fund's standing are public,
 * and the price everything after this is worked out from is public with them.
 */
test.describe.configure({ timeout: 420_000 });

test('Sign both sides in, take a director\u2019s seat, and read both records', async ({ page }) => {
  test.skip(
    !credentials,
    'set RESEND_API_KEY and a director address on a Resend inbound domain to run this',
  );
  test.skip(!onchain.business, 'nothing onboarded yet — run the ENS onboarding script first');

  const { email, key } = credentials!;

  /* Step 1 — the judge signs in to the business portal. An email, a code, and no key at all. */
  await signIn(page, BUSINESS_SIGNED_IN, email, key);
  await expect(page.getByText(onchain.business!.name).first()).toBeVisible();

  /*
   * And signing in seated them: the third seat on the company wallet belongs to whoever is
   * here, which is what lets a stranger be one of the two signatures a financing takes. The
   * seat is granted by Privy, so this asserts what Privy answered rather than what we hoped.
   */
  await expect(page.getByTestId('director-seat')).toHaveAttribute('data-seated', 'true', {
    timeout: 30_000,
  });

  /* Clicking that name opens its record — seven invoices of history, on ENS's own explorer. */
  await readRecord(page, onchain.business!.name);

  /* Step 2 — Woodgrove signs in the same way, in what a viewer watches as the next tab. */
  await signIn(page, INVESTOR_SIGNED_IN, FUND_EMAIL, key);
  await expect(page.getByText(onchain.investor!.name).first()).toBeVisible();

  /* And the fund's name resolves the same way, to the standing behind it. */
  await readRecord(page, onchain.investor!.name);
});
