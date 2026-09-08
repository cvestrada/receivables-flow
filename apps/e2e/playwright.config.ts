import { defineConfig } from '@playwright/test';

/*
 * Both portals are started for real and driven through a browser.
 *
 * The claim this suite exists to check is that a refusal reaches the screen, so
 * it has to be checked on a screen. Everything below the button — the route
 * handler, the account, the rule — is the running system, not a stand-in.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  /*
   * Built and served, not run in dev.
   *
   * The dev server's hot-reload channel does not survive a headless browser here,
   * and without it the page arrives fully rendered but never becomes interactive —
   * every click lands on markup that is not listening, which reads as a broken
   * feature rather than a broken harness. A production build is also what anyone
   * is actually going to look at.
   */
  webServer: [
    {
      command: 'npm run build -w @rf/business && npm run start -w @rf/business -- --port 3200',
      url: 'http://127.0.0.1:3200',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    {
      command: 'npm run build -w @rf/investor && npm run start -w @rf/investor -- --port 3201',
      url: 'http://127.0.0.1:3201',
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
