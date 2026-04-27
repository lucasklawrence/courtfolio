/**
 * Vitest config for the courtfolio repo.
 *
 * - `jsdom` env so React Testing Library works for component tests added in
 *   later PRs (PR1 only ships pure-function tests but the env is wired up
 *   here so future tests don't have to migrate the harness).
 * - `@/*` path alias mirrors `tsconfig.json` so test imports match source.
 * - `v8` coverage provider — built-in, no native deps. Reports cover the
 *   modules issue #104 calls out (`lib/`, `constants/`, the Training Facility
 *   shared components). No threshold gate on PR1; later PRs add coverage to
 *   reach the issue's ≥80% aggregate target.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'lib/**/*.{ts,tsx}',
        'constants/**/*.{ts,tsx}',
        'components/training-facility/shared/**/*.{ts,tsx}',
        'app/api/**/*.{ts,tsx}',
      ],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
  },
})
