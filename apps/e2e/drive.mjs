/* Use the app the way a judge will: real sign-in, real buttons, real chains. Screenshot each stop. */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { waitForSignInCode } from './src/u1-capital-cycle/otp.support.ts';

const env = Object.fromEntries(readFileSync('../../.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,'')];}));
const KEY = env.RESEND_API_KEY;
const BIZ_EMAIL = env.E2E_DIRECTOR_EMAIL ?? env.PRIVY_BUSINESS_DIRECTOR_EMAILS.split(',')[0].trim();
const INV_EMAIL = env.E2E_FUND_EMAIL ?? BIZ_EMAIL.replace(/^[^@]+/, 'inv-woodgrove');
const OUT = '/tmp/claude-1000/-home-orbbit-receivables-flow/demo';
const B = 'http://127.0.0.1:3200', I = 'http://127.0.0.1:3201';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1340, height: 900 } });
const page = await ctx.newPage();
let n = 0;
const shot = async (name) => { n += 1; await page.screenshot({ path: `${OUT}/${String(n).padStart(2,'0')}-${name}.png` }); console.log(`✓ ${n} ${name}`); };
const step = async (name, fn) => { try { await fn(); await shot(name); } catch (e) { await shot(`${name}-FAILED`); console.log(`✗ ${name}: ${String(e).split('\n')[0]}`); throw e; } };

async function signIn(url, email) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const address = page.getByPlaceholder(/email/i).or(page.getByRole('textbox').first());
  await address.waitFor({ timeout: 30000 });
  await address.fill(email);
  const sentAt = Date.now();
  await page.getByRole('button', { name: /submit|continue|next/i }).first().click();
  const code = await waitForSignInCode(email, sentAt, KEY);
  await page.getByRole('textbox').first().click();
  await page.keyboard.type(code, { delay: 60 });
  await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 60000 });
}

// 0. reset
await step('reset', async () => { const r = await page.request.post(`${B}/api/demo`, { timeout: 180000 }); if (!r.ok()) throw new Error('reset ' + r.status()); });

// 1. business sign-in
await step('business-signed-in', () => signIn(B, BIZ_EMAIL));
await step('ens-chip-open', async () => { await page.getByRole('button', { name: /ironline\.business/ }).click(); });
await page.keyboard.press('Escape');

// 2. submit wizard
await step('invoices-outstanding', () => page.goto(`${B}/invoices/outstanding`));
await step('wizard-invoice', () => page.getByTestId('submit-invoice').click());
await step('wizard-price', () => page.getByTestId('wizard-next').click());
await step('wizard-sign', async () => { await page.getByTestId('wizard-next').click(); await page.getByTestId('wizard-approve').waitFor({ timeout: 30000 }); });
await step('privy-answered', async () => { await page.getByTestId('wizard-approve').click(); await page.getByTestId('privy-answer').or(page.getByTestId('wizard-refusal')).first().waitFor({ timeout: 150000 }); });
if (await page.getByTestId('wizard-refusal').isVisible()) throw new Error('mint refused: ' + await page.getByTestId('wizard-refusal').innerText());
await step('financed', async () => { await page.getByTestId('wizard-done').click(); await page.getByTestId('financed-term').waitFor({ timeout: 30000 }); });
await step('hashscan-mint', async () => { const [t] = await Promise.all([ctx.waitForEvent('page'), page.getByTestId('financed-transaction').click()]); await t.waitForLoadState('domcontentloaded'); await t.close(); });

// 3. investor
await step('investor-signed-in', () => signIn(I, INV_EMAIL));
await step('offered', () => page.goto(`${I}/portfolio/offered`));
await step('funded', async () => { await page.getByRole('button', { name: /Fund \$/ }).click(); await page.getByRole('dialog', { name: /fund's account/ }).waitFor({ timeout: 60000 }); });
await step('funded-closed', async () => { await page.getByRole('button', { name: 'Close' }).click(); });
await step('held', () => page.goto(`${I}/portfolio/held`));
await step('sold-half', async () => { await page.getByRole('button', { name: /^Sell half/ }).click(); await page.getByTestId('resale-split').or(page.getByTestId('resale-refusal')).first().waitFor({ timeout: 90000 }); });
if (await page.getByTestId('resale-refusal').isVisible()) console.log('  resale refused: ' + await page.getByTestId('resale-refusal').innerText());

// 4. day 60
await step('day60', async () => { await page.goto(`${B}/invoices/financed`); await page.getByRole('button', { name: /repayment/i }).click(); await page.getByTestId('repay-owed').waitFor(); });
await step('repaid', async () => { await page.getByRole('button', { name: /^Repay \$/ }).click(); await page.getByTestId('repay-outcome').waitFor({ timeout: 180000 }); });
await step('record-after', async () => { await page.getByTestId('outcome-score-after').waitFor({ timeout: 180000 }); });
await b.close();
console.log('DONE');
