/**
 * Vitest config for the courtfolio repo.
 *
 * - `jsdom` env so React Testing Library works for component tests.
 * - `@/*` path alias mirrors `tsconfig.json` so test imports match source.
 * - `v8` coverage provider — built-in, no native deps. Reports cover the
 *   modules issue #104 calls out (`lib/`, `constants/`, the Training Facility
 *   shared components, the dev API routes added in step 2).
 * - Per-path `lines >= 80` threshold gates each of the three directories
 *   the issue's "Done when" lists. Branches/functions/statements aren't
 *   gated (they correlate with lines and gating four metrics produces
 *   noisier failures without proportional signal).
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` throws when imported outside a Next.js server
      // context. Vitest doesn't honor the `react-server` export
      // condition, so map it to the package's own no-op stub —
      // server-only's job is the build-time guard, not runtime
      // behavior, so the alias is safe.
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
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
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        // Pre-existing courtfolio constants outside the #104 Training
        // Facility scope. The issue explicitly says to keep this work
        // "scoped to the modules added during the Training Facility build."
        'constants/playerSize.ts',
        'constants/tourSteps.ts',
      ],
      thresholds: {
        'lib/**': { lines: 80 },
        'constants/**': { lines: 80 },
        'components/training-facility/shared/**': { lines: 80 },
      },
    },
  },
})
