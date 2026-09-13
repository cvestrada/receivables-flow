import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@playwright/test';

/*
 * The credentials live in one file at the repository root, and the test process gets none of
 * them by default — a spec that reads a Resend key out of `process.env` would skip on a machine
 * where the key is sitting two directories up. `.env.local` first, the same order every other
 * package here reads them in.
 */
for (const file of ['.env.local', '.env']) {
  loadEnv({ path: join(import.meta.dirname, '..', '..', file) });
}

/*
 * All three portals are started for real and driven through a browser.
 *
 * The claim this suite exists to check is that a refusal reaches the screen, so
 * it has to be checked on a screen. Everything below the button — the route
 * handler, the account, the rule — is the running system, not a stand-in.
 *
 * The tree under `src` is the capital cycle itself: one directory per phase, one
 * spec per goal, one test per step. A goal with a step nothing asserts yet keeps
 * the step as a `test.fixme` saying what is missing, so a phase can never look
 * covered because the gap was left out of the file.
 */
export default defineConfig({
  testDir: './src',
  fullyParallel: false,
  workers: 1,
  /*
   * The list for the terminal, and the HTML report for the traces.
   *
   * With `list` alone no report was written at all, so `show-report` kept serving whatever run
   * had last produced one — a green page from a previous day, describing a UI that no longer
   * existed. `open: 'never'` because the report is served deliberately, on a chosen port.
   */
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    /*
     * Kept only when something failed. Pass `--video on` to record a passing run
     * too — worth doing when the point is to watch a refusal happen rather than
     * to find out whether it did.
     */
    video: 'retain-on-failure',
  },
  /*
   * Built and served, not run in dev.
   *
   * The dev server's hot-reload channel does not survive a headless browser here,
   * and without it the page arrives fully rendered but never becomes interactive —
   * every click lands on markup that is not listening, which reads as a broken
   * feature rather than a broken harness. A production build is also what anyone
   * is actually going to look at.
   *
   * The app id is cleared rather than inherited, so the portals open straight onto
   * the dashboard instead of a sign-in. Left to whatever `.env.local` happens to
   * hold, this suite would pass on a fresh clone and fail for everyone who had
   * configured credentials — the result would describe the machine, not the code.
   * Signing in as a real director is checked by hand; see docs/accounts.md.
   */
  webServer: [
    {
      command: 'npm run build -w @rf/business && npm run start -w @rf/business -- --port 3200',
      url: 'http://127.0.0.1:3200',
      cwd: '../..',
      env: { NEXT_PUBLIC_PRIVY_APP_ID: '' },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    {
      command: 'npm run build -w @rf/investor && npm run start -w @rf/investor -- --port 3201',
      url: 'http://127.0.0.1:3201',
      cwd: '../..',
      env: { NEXT_PUBLIC_PRIVY_APP_ID: '' },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    /*
     * The same business portal, built with the Privy app id left in, so the sign-in gate is
     * rendered instead of skipped. Only the sign-in spec drives it: every other spec wants the
     * portal a judge can open without an account, and a suite that made everybody sign in
     * would be asserting Privy's uptime on the way to asserting a receivable.
     *
     * NEXT_PUBLIC_* values are inlined at build time, which is why this is a second build on a
     * second port rather than an environment variable set at runtime.
     */
    {
      command: 'npm run build -w @rf/business && npm run start -w @rf/business -- --port 3210',
      url: 'http://127.0.0.1:3210',
      cwd: '../..',
      /*
       * Its own build directory. Two builds of one app into one `.next` is a race, and the
       * loser is whichever server started first — which is how a signed-out portal ended up
       * serving the sign-in gate to every other spec.
       */
      env: { NEXT_DIST_DIR: '.next-signin' },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
    /* The fund's portal, likewise built with the app id so its own gate is rendered. */
    {
      command: 'npm run build -w @rf/investor && npm run start -w @rf/investor -- --port 3211',
      url: 'http://127.0.0.1:3211',
      cwd: '../..',
      env: { NEXT_DIST_DIR: '.next-signin' },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
