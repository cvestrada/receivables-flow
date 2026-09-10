import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/*
 * Only the source tree. Left to itself vitest also collects `e2e/`, where the Playwright specs
 * live, and fails on a `test.describe` that belongs to the other runner.
 *
 * The `@/` alias is repeated here because the app's own imports use it and vitest reads this
 * file rather than the Next config that ordinarily resolves it.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
