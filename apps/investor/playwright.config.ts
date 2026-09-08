import { defineConfig } from '@playwright/test';

/*
 * The portal is booted by the run itself rather than assumed to be up, so the check is the
 * same whether it runs here or in CI. The read it makes goes to Sepolia over the network,
 * which is the point of the test — a mocked chain would prove only that the component
 * renders its props.
 *
 * A production build rather than the dev server: dev keeps a hot-reload socket open that the
 * test has no use for, and a check meant to stand in for what a judge opens should run the
 * bundle a judge would be served.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:3100' },
  webServer: {
    command: 'npm run build && npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
