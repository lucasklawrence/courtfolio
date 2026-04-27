/**
 * Vitest global setup.
 *
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

afterEach(() => {
  cleanup()
})
