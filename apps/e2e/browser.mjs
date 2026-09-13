/* A visible Chrome window on your desktop that I drive one click at a time over CDP. */
import { chromium } from '@playwright/test';
const b = await chromium.launch({ headless: false, args: ['--remote-debugging-port=9222', '--window-size=1400,950'] });
const ctx = await b.newContext({ viewport: null });
const page = await ctx.newPage();
await page.goto('http://localhost:3200/invoices/outstanding');
console.log('window open on your desktop; CDP on :9222');
await new Promise(() => {});
