/**
 * Tests for the OTbeat class-type heuristic (#271).
 *
 * The classifier infers a coarse class-type label from a session's machine
 * signature at ingest. The cases pin each branch against the shape of the real
 * dataset — both-machine classes (the common 'Tread + Row'), tread-only days,
 * the two row-heavy classes (05/14, 05/16 — rower time exceeds tread time), and
 * the machine-less strength/malfunction split.
 */
import { describe, expect, it } from 'vitest'

import {
  OTF_CLASS_TYPE_BOTH,
  OTF_CLASS_TYPE_ROW,
  OTF_CLASS_TYPE_STRENGTH,
  OTF_CLASS_TYPE_TREAD,
  classifyOtfClassType,
} from './otbeat-class-type.mjs'

describe('classifyOtfClassType', () => {
  it('labels a both-machine class as Tread + Row when tread time dominates', () => {
    // 04/12: tread 14:39 (879s) > rower 05:23 (323s).
    expect(
      classifyOtfClassType({
        hasTreadmill: true,
        hasRower: true,
        treadSec: 879,
        rowerSec: 323,
        calories: 541,
      })
    ).toBe(OTF_CLASS_TYPE_BOTH)
  })

  it('labels a both-machine class as Row-focused when the rower time exceeds the tread time', () => {
    // 05/16: rower 19:21 (1161s) > tread 16:44 (1004s).
    expect(
      classifyOtfClassType({
        hasTreadmill: true,
        hasRower: true,
        treadSec: 1004,
        rowerSec: 1161,
        calories: 710,
      })
    ).toBe(OTF_CLASS_TYPE_ROW)
  })

  it('labels a tread-only class (no rower block) as Tread-focused', () => {
    expect(
      classifyOtfClassType({
        hasTreadmill: true,
        hasRower: false,
        treadSec: 1573,
        calories: 692,
      })
    ).toBe(OTF_CLASS_TYPE_TREAD)
  })

  it('labels a rower-only class (no treadmill block) as Row-focused', () => {
    expect(
      classifyOtfClassType({
        hasTreadmill: false,
        hasRower: true,
        rowerSec: 900,
        calories: 500,
      })
    ).toBe(OTF_CLASS_TYPE_ROW)
  })

  it('labels a machine-less class with real output as Strength / Floor', () => {
    expect(
      classifyOtfClassType({
        hasTreadmill: false,
        hasRower: false,
        calories: 300,
      })
    ).toBe(OTF_CLASS_TYPE_STRENGTH)
  })

  it('returns null for the near-zero belt-malfunction shape (no machines, minimal calories)', () => {
    // 05/30: 4 calories, no machine block — already excluded by #268.
    expect(
      classifyOtfClassType({
        hasTreadmill: false,
        hasRower: false,
        calories: 4,
      })
    ).toBeNull()
  })

  it('pins the Strength / Floor calorie boundary at 100', () => {
    expect(
      classifyOtfClassType({ hasTreadmill: false, hasRower: false, calories: 100 })
    ).toBe(OTF_CLASS_TYPE_STRENGTH)
    expect(
      classifyOtfClassType({ hasTreadmill: false, hasRower: false, calories: 99 })
    ).toBeNull()
  })

  it('treats equal tread/rower time as Tread + Row (tie does not flip to Row-focused)', () => {
    expect(
      classifyOtfClassType({
        hasTreadmill: true,
        hasRower: true,
        treadSec: 600,
        rowerSec: 600,
      })
    ).toBe(OTF_CLASS_TYPE_BOTH)
  })

  it('treats absent tread/rower seconds as zero (both machines, no times → Tread + Row)', () => {
    expect(
      classifyOtfClassType({ hasTreadmill: true, hasRower: true })
    ).toBe(OTF_CLASS_TYPE_BOTH)
  })

  it('treats absent calories as zero for a machine-less class (→ null)', () => {
    expect(classifyOtfClassType({ hasTreadmill: false, hasRower: false })).toBeNull()
  })
})
