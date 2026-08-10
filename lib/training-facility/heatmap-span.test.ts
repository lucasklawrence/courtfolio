/**
 * Tests for the History view's heatmap span (#438).
 *
 * The heatmaps drew a trailing year, which was the whole log until #400
 * backfilled 2022-2024 — after which the archive was invisible on the only
 * calendar surface in the room. These pin the two things that would break the
 * all-time view quietly: a bad param taking the page down, and a start date
 * landing a day early because of a midnight boundary.
 */
import { describe, expect, it } from 'vitest'

import type { StrengthSet } from '@/types/weight-room'

import {
  DEFAULT_HEATMAP_SPAN,
  firstLoggedDate,
  heatmapCellMetrics,
  heatmapWindowStart,
  parseHeatmapSpan,
} from './heatmap-span'

/** A set logged at a given Pacific-local day. */
function loggedOn(dayKey: string, hourUtc = 20): StrengthSet {
  return {
    id: dayKey,
    logged_at: `${dayKey}T${String(hourUtc).padStart(2, '0')}:00:00Z`,
    exercise: 'pullups',
    reps: 5,
  }
}

describe('parseHeatmapSpan', () => {
  it('reads the all-time span', () => {
    expect(parseHeatmapSpan('all')).toBe('all')
  })

  it('defaults to the trailing year', () => {
    expect(parseHeatmapSpan(undefined)).toBe('year')
    expect(parseHeatmapSpan('year')).toBe('year')
  })

  it('falls back rather than erroring on a stale or hand-typed value', () => {
    expect(parseHeatmapSpan('everything')).toBe(DEFAULT_HEATMAP_SPAN)
    expect(parseHeatmapSpan('')).toBe(DEFAULT_HEATMAP_SPAN)
  })

  it('takes the first value when the param arrives repeated', () => {
    expect(parseHeatmapSpan(['all', 'year'])).toBe('all')
  })
})

describe('firstLoggedDate', () => {
  it('finds the earliest training day', () => {
    const date = firstLoggedDate([loggedOn('2026-08-09'), loggedOn('2022-03-03')])
    expect(date).not.toBeNull()
    expect(date?.toISOString().slice(0, 10)).toBe('2022-03-03')
  })

  it('is null for an empty log', () => {
    expect(firstLoggedDate([])).toBeNull()
  })

  it('uses the local day, not the UTC one', () => {
    // 2022-03-04 01:00 UTC is still 2022-03-03 in Pacific. Bucketing on UTC
    // would start the grid a day — and therefore possibly a column — late.
    const date = firstLoggedDate([loggedOn('2022-03-04', 1)])
    expect(date?.toISOString().slice(0, 10)).toBe('2022-03-03')
  })
})

describe('heatmapWindowStart', () => {
  it('leaves the component on its own default for the trailing year', () => {
    expect(heatmapWindowStart('year', [loggedOn('2022-03-03')])).toBeNull()
  })

  it('starts at the first logged day for all-time', () => {
    const start = heatmapWindowStart('all', [loggedOn('2024-04-16'), loggedOn('2022-03-03')])
    expect(start?.toISOString().slice(0, 10)).toBe('2022-03-03')
  })

  it('is null for an all-time view of an empty log', () => {
    // Nothing to widen to; the component's default is the honest fallback.
    expect(heatmapWindowStart('all', [])).toBeNull()
  })
})

describe('heatmapCellMetrics', () => {
  it('tightens the cell for the all-time view', () => {
    // ~210 columns at the default stride is nearly 3,000px, wide enough that
    // the shape of the history is lost to panning.
    expect(heatmapCellMetrics('all').cellSize).toBeLessThan(heatmapCellMetrics('year').cellSize)
  })

  it('keeps the whole log within a couple of screens of panning', () => {
    // Nothing legible fits the ~900px content column outright, so the budget is
    // how far you have to pan: two screens, not the three and a half the
    // default stride would cost.
    const { cellSize } = heatmapCellMetrics('all')
    expect(232 * cellSize).toBeLessThan(2 * 900)
  })

  it('leaves the trailing year at the established size', () => {
    expect(heatmapCellMetrics('year')).toEqual({ cellSize: 14, cellGap: 2 })
  })
})
