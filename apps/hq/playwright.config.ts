import { defineConfig } from '@playwright/test';

/*
 * A production build rather than the dev server, and never a server that happens to be up
 * already: the page bakes the deployment record in at build time, so a leftover process would
 * let the suite pass against a bundle built before the chain state it is meant to be checking.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  use: {
    baseURL: 'http://127.0.0.1:3200',
    /* A recording of the run survives where a trace does not — a trace viewer needs a secure
     * context, which a machine on a LAN address is not. */
    video: 'on',
    trace: 'on',
  },
  webServer: {
    command: 'npm run build && npm run start -- --port 3200',
    url: 'http://127.0.0.1:3200',
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
