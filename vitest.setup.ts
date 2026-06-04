/**
 * Vitest global setup.
 *
 * - Disables telemetry emission (#220) so no test can construct a Pub/Sub
 *   client or attempt a publish. `lib/telemetry/client.test.ts` deletes the
 *   var per-test to exercise the enabled path against a mocked Pub/Sub.
 * - Extends `expect` with `@testing-library/jest-dom` matchers
 *   (`toBeInTheDocument`, `toHaveAttribute`, etc.) so component tests read
 *   naturally without per-file imports.
 * - Wires `cleanup` into `afterEach` so RTL unmounts the previous test's tree
 *   before the next render. Without this, tests that re-render the same
 *   component see "Found multiple elements" errors because mounted DOM leaks
 *   across test boundaries — RTL's auto-cleanup only fires under Jest, not
 *   Vitest.
 */
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

process.env.TELEMETRY_DISABLED = '1'

afterEach(() => {
  cleanup()
})
