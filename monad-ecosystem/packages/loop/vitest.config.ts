import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Per-package vitest config for @sovereign/loop.
 *
 * Aliased workspace deps to their `src/` so the test path doesn't depend
 * on a prior `pnpm build` having populated each sibling's `dist/`.
 * CI works because `pnpm validate` chains build → test:integration,
 * but local per-package dev work was broken before this alias.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@sovereign/bus': resolve(__dirname, '../sovereign-bus/src'),
      '@sovereign/types': resolve(__dirname, '../sovereign-types/src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
