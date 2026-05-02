import { describe, expect, it } from 'vitest'

import { isPreviewDemoActive } from './preview-param'

/**
 * Standalone tests for the cross-context preview-param predicate
 * (#162). Lives in its own file (separate from `use-cardio-preview.test.ts`)
 * because the predicate must be importable from Server Components,
 * which means it lives in a non-`'use client'` module — and the test
 * here mirrors that import path so a future regression that re-routes
 * the predicate through a client module would surface in CI.
 */

describe('isPreviewDemoActive', () => {
  it('matches the literal "demo" string (client-side useSearchParams shape)', () => {
    expect(isPreviewDemoActive('demo')).toBe(true)
  })

  it('matches an array containing "demo" (server-side multi-value shape)', () => {
    expect(isPreviewDemoActive(['other', 'demo'])).toBe(true)
  })

  it('rejects null / undefined / empty / unrelated values', () => {
    expect(isPreviewDemoActive(null)).toBe(false)
    expect(isPreviewDemoActive(undefined)).toBe(false)
    expect(isPreviewDemoActive('')).toBe(false)
    expect(isPreviewDemoActive('truthy-but-not-demo')).toBe(false)
    expect(isPreviewDemoActive([])).toBe(false)
    expect(isPreviewDemoActive(['x', 'y'])).toBe(false)
  })
})
