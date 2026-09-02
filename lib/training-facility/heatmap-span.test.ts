/**
 * Tests for the History view's heatmap range (#438).
 *
 * The heatmaps drew a trailing year, which was the whole log until #400
 * backfilled 2022-2024 — after which the archive was invisible on the only
 * calendar surface in the room.
 *
 * The cases that matter are the ones where the window and the cell size have to
 * agree. Deciding them separately is what produced an "All time" view that was
 * *narrower* than the default on a short log, so most of this file is about
 * that pairing rather than about either number alone.
 */
import { describe, expect, it } from 'vitest'

import type { StrengthSet } from '@/types/weight-room'

import {
  DEFAULT_HEATMAP_SPAN,
  firstLoggedDate,
  heatmapWindow,
  parseHeatmapSpan,
} from './heatmap-span'

/** Fixed "today" for every window case, so column counts are stable. */
const NOW = new Date('2026-08-09T20:00:00Z')

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
  it('reads the all-time range', () => {
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

describe('heatmapWindow', () => {
  it('leaves the trailing year on the component defaults', () => {
    expect(heatmapWindow('year', [loggedOn('2022-03-03')], undefined, NOW)).toEqual({
      dateFrom: null,
      cellSize: 14,
      cellGap: 2,
    })
  })

  it('starts at the first logged day for all-time', () => {
    const { dateFrom } = heatmapWindow(
      'all',
      [loggedOn('2024-04-16'), loggedOn('2022-03-03')],
      undefined,
      NOW
    )
    expect(dateFrom?.toISOString().slice(0, 10)).toBe('2022-03-03')
  })

  it('tightens the cell in proportion to the widened grid', () => {
    const { cellSize, cellGap } = heatmapWindow('all', [loggedOn('2022-03-03')], undefined, NOW)
    expect(cellSize).toBeLessThan(14)
    expect(cellGap).toBe(1)
  })

  it('keeps four years of columns within a couple of screens of panning', () => {
    // Not a fit — the content column is ~900px and four years cannot fit it at
    // any legible size. The budget is how far you have to pan.
    const { dateFrom, cellSize } = heatmapWindow('all', [loggedOn('2022-08-23')], undefined, NOW)
    const cols = Math.ceil((NOW.getTime() - (dateFrom?.getTime() ?? 0)) / (7 * 86_400_000))
    expect(cols * cellSize).toBeLessThan(2 * 900)
  })

  it('never renders all-time smaller than the default it replaces', () => {
    // The bug this pairing exists to prevent: the start came from the data
    // while the cell size came from the span *name*, so a log shorter than the
    // default window produced a two-column sliver of 6px cells — narrower and
    // less legible than the view it replaced, showing no extra data.
    const shortLog = [loggedOn('2026-07-20'), loggedOn('2026-08-05')]
    expect(heatmapWindow('all', shortLog, undefined, NOW)).toEqual({
      dateFrom: null,
      cellSize: 14,
      cellGap: 2,
    })
  })

  it('falls back to the component default for an all-time view of an empty log', () => {
    expect(heatmapWindow('all', [], undefined, NOW)).toEqual({
      dateFrom: null,
      cellSize: 14,
      cellGap: 2,
    })
  })

  it('holds the cell above the floor even for an absurdly old first set', () => {
    // A corrupt `logged_at` shouldn't shrink the grid to invisibility; the
    // column cap in buildStrengthHeatmap handles the width, this handles the
    // cell.
    const { cellSize } = heatmapWindow('all', [loggedOn('1970-01-05')], undefined, NOW)
    expect(cellSize).toBeGreaterThanOrEqual(6)
  })
})
