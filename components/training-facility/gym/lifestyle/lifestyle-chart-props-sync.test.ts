import { describe, it, expect } from 'vitest'

import type {
  BaseLifestyleTrendChartProps,
  LifestyleChartProps,
} from './BaseLifestyleTrendChart'

/**
 * Compile-time + runtime guard for the two-interface drift risk flagged
 * by CodeRabbit on #188 and tracked in #190 item 3.
 *
 * `LifestyleChartProps` (call-site-facing) and `BaseLifestyleTrendChartProps`
 * (internal) both live in `BaseLifestyleTrendChart.tsx`. By design,
 * `LifestyleChartProps === Omit<BaseLifestyleTrendChartProps, 'yLabel' |
 * 'yTickFormat' | 'emptyMessage' | 'ariaLabel'>`, but the explicit
 * interface form lets each forwarded prop keep its own JSDoc — at the
 * cost of two declarations that could drift.
 *
 * The type alias below derives the expected forwarded-keys set from the
 * base interface. If the two interfaces fall out of sync (a new prop
 * lands on one and not the other, or a key is renamed in one place),
 * the `Equal<…>` resolution flips to `false` and `_typeCheck` fails to
 * compile — caught by `npx tsc --noEmit` before this test ever runs.
 *
 * The trivial runtime `expect` is there so vitest counts this as a real
 * test (otherwise `it` with an empty body is a lint smell).
 */

type ForwardedKeys = Exclude<
  keyof BaseLifestyleTrendChartProps,
  'yLabel' | 'yTickFormat' | 'emptyMessage' | 'ariaLabel'
>

// Mutual `extends` for symmetric equality. A simple `keyof X extends keyof Y`
// would let extra keys on Y slip through.
type Equal<A extends string | number | symbol, B extends string | number | symbol> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false

type LifestyleKeysMatchForwarded = Equal<keyof LifestyleChartProps, ForwardedKeys>

const _typeCheck: LifestyleKeysMatchForwarded = true
void _typeCheck

describe('LifestyleChartProps ↔ BaseLifestyleTrendChartProps', () => {
  it('keys stay in sync (enforced via the type assertion above)', () => {
    // If the two interfaces drift, the assignment above will fail tsc.
    // The runtime expect is here so vitest treats this as a real test.
    expect(true).toBe(true)
  })
})
