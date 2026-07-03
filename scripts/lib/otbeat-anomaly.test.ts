/**
 * Tests for the OTbeat anomaly heuristic (#268).
 *
 * The heuristic decides which sessions are auto-flagged `excluded` at ingest.
 * The stakes are false positives (hiding a real class) and false negatives
 * (letting a malfunction skew aggregates), so the cases pin the exact
 * threshold boundaries against the shape of the real dataset — the 05/30
 * belt-malfunction anomaly (4 cal, 0 splat, no machine block) vs the lowest
 * legitimate class (541 cal, both blocks present).
 */
import { describe, expect, it } from 'vitest'

import { AUTO_EXCLUDE_REASON, classifyOtfAnomaly } from './otbeat-anomaly.mjs'

describe('classifyOtfAnomaly', () => {
  it('flags the belt-malfunction shape (near-zero output, no machine block)', () => {
    const result = classifyOtfAnomaly({
      calories: 4,
      splat: 0,
      hasTreadmill: false,
      hasRower: false,
    })
    expect(result).toEqual({ excluded: true, reason: AUTO_EXCLUDE_REASON })
  })

  it('does not flag a real class (hundreds of calories, both blocks present)', () => {
    const result = classifyOtfAnomaly({
      calories: 541,
      splat: 2,
      hasTreadmill: true,
      hasRower: true,
    })
    expect(result).toEqual({ excluded: false, reason: null })
  })

  it('does not flag a real tread-only class (rower omitted but treadmill present)', () => {
    // A legitimate format can omit the rower; the treadmill block alone is
    // enough to prove it was a real workout, so near-zero-cal never applies.
    const result = classifyOtfAnomaly({
      calories: 692,
      splat: 15,
      hasTreadmill: true,
      hasRower: false,
    })
    expect(result.excluded).toBe(false)
  })

  it('requires BOTH machine blocks to be absent — one present is enough to keep', () => {
    expect(
      classifyOtfAnomaly({ calories: 4, splat: 0, hasTreadmill: false, hasRower: true }).excluded
    ).toBe(false)
    expect(
      classifyOtfAnomaly({ calories: 4, splat: 0, hasTreadmill: true, hasRower: false }).excluded
    ).toBe(false)
  })

  it('keeps a machine-less class once calories cross the threshold', () => {
    // No machine block but real calories → not a malfunction, don't hide it.
    expect(
      classifyOtfAnomaly({ calories: 25, splat: 0, hasTreadmill: false, hasRower: false }).excluded
    ).toBe(false)
    expect(
      classifyOtfAnomaly({ calories: 24, splat: 0, hasTreadmill: false, hasRower: false }).excluded
    ).toBe(true)
  })

  it('keeps a machine-less class once splat crosses the threshold', () => {
    // >1 splat means real orange/red-zone minutes were logged — a real effort.
    expect(
      classifyOtfAnomaly({ calories: 4, splat: 2, hasTreadmill: false, hasRower: false }).excluded
    ).toBe(false)
    expect(
      classifyOtfAnomaly({ calories: 4, splat: 1, hasTreadmill: false, hasRower: false }).excluded
    ).toBe(true)
  })

  it('treats absent calories/splat as zero (a header-only anomaly still flags)', () => {
    const result = classifyOtfAnomaly({
      calories: null,
      splat: undefined,
      hasTreadmill: false,
      hasRower: false,
    })
    expect(result.excluded).toBe(true)
  })
})
