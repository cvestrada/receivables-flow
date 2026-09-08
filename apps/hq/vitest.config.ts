import { defineConfig } from 'vitest/config';

/*
 * Only the source tree. Left to itself vitest also collects `e2e/`, where the Playwright specs
 * live, and fails on a `test.describe` that belongs to the other runner.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
