/* One action on the visible window, then a screenshot of what it shows. */
import { chromium } from '@playwright/test';
const [, , action, ...args] = process.argv;
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = b.contexts()[0].pages()[0];
try {
  if (action === 'goto') await page.goto(args[0]);
  if (action === 'click') await page.getByRole(args[0], { name: new RegExp(args[1], 'i') }).first().click({ timeout: 15000 });
  if (action === 'testid') await page.getByTestId(args[0]).click({ timeout: 15000 });
  if (action === 'fill') { const box = page.getByPlaceholder(/email/i).or(page.getByRole('textbox').first()); await box.fill(args[0]); }
  if (action === 'type') { await page.getByRole('textbox').first().click(); await page.keyboard.type(args[0], { delay: 60 }); }
  if (action === 'wait') await page.getByTestId(args[0]).waitFor({ timeout: Number(args[1] ?? 60000) });
  if (action === 'key') await page.keyboard.press(args[0]);
  await page.waitForTimeout(Number(process.env.SETTLE ?? 800));
  await page.screenshot({ path: '/tmp/claude-1000/-home-orbbit-receivables-flow/demo/now.png' });
  console.log('url', page.url());
} finally { await b.close(); }
