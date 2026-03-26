import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.{js,mjs}', '**/*.test.{js,mjs}'],
    coverage: {
      provider: 'v8',
      include: ['shared/**', 'schemas/**', 'jobs/**', 'routes/**'],
    },
  },
});
