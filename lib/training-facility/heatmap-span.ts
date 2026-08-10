import type { StrengthSet } from '@/types/weight-room'

import { PACIFIC_CLOCK, type DayClock } from './clock'

/**
 * How much history the History view's heatmaps show (#438).
 *
 * They have always drawn a trailing year, which was the whole log when the log
 * began in May 2026. #400 backfilled 2022-2024, and a rolling twelve-month
 * window renders that entire archive as nothing at all — the only surface in
 * the room where four years of training is invisible rather than merely
 * summarized.
 *
 * The trailing year stays the default, because it is the right answer to "how
 * am I doing lately" and that is what the page is mostly for. All-time is a
 * deliberate second view rather than a replacement.
 */

/** Search-param name carrying the chosen span. */
export const HEATMAP_SPAN_PARAM = 'span'

/** Which window the heatmaps draw. */
export type HeatmapSpan = 'year' | 'all'

/** The default — a trailing year, as the heatmaps have always drawn. */
export const DEFAULT_HEATMAP_SPAN: HeatmapSpan = 'year'

/**
 * Read the span out of a search param.
 *
 * Anything unrecognized falls back to the default rather than erroring: a
 * hand-typed or stale URL should render the normal page, not a broken one.
 *
 * @param raw The param value, which Next may hand over repeated.
 * @returns The span to draw.
 */
export function parseHeatmapSpan(raw: string | string[] | undefined): HeatmapSpan {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'all' ? 'all' : DEFAULT_HEATMAP_SPAN
}

/**
 * The earliest day any set was logged, as a `Date` at local noon.
 *
 * Noon rather than midnight for the same reason the progression charts use it:
 * a midnight boundary read in the wrong zone slides onto the previous day, and
 * the heatmap's first column would start a week early.
 *
 * @param sets Every logged set.
 * @param clock Zone each day is measured in; defaults to Pacific (#429).
 * @returns The first training day, or `null` when nothing is logged.
 */
export function firstLoggedDate(
  sets: readonly StrengthSet[],
  clock: DayClock = PACIFIC_CLOCK
): Date | null {
  let earliest = ''
  for (const set of sets) {
    const dayKey = clock.safeDayKey(set.logged_at)
    if (dayKey === '') continue
    if (earliest === '' || dayKey < earliest) earliest = dayKey
  }
  return earliest === '' ? null : clock.toNoon(earliest)
}

/** Columns in the heatmaps' established trailing-year window. */
const DEFAULT_COLS = 52

/** Cell stride the heatmaps have always drawn at, and the widest this returns. */
const DEFAULT_CELL = { cellSize: 14, cellGap: 2 } as const

/**
 * Pixel width the all-time grid aims for.
 *
 * Not a fit — the content column is ~900px, and fitting four years inside it
 * would need a 4px stride. It's a panning budget: ~1,400px is a screen and a
 * half, where the default stride over the same span would be three and a half.
 */
const ALL_TIME_TARGET_WIDTH = 1400

/** Floor on the stride, below which a cell stops reading as its own square. */
const MIN_CELL_SIZE = 6

/** How a heatmap should draw one span. */
export interface HeatmapWindow {
  /**
   * Inclusive start to hand the heatmap, or `null` to leave it on its own
   * trailing-year default.
   */
  dateFrom: Date | null
  /** Pixel stride per column, including the gap. */
  cellSize: number
  /** Pixel gap between cells. */
  cellGap: number
}

/**
 * Resolve the window *and* the cell size a heatmap should draw a span at.
 *
 * One function rather than two, because the two answers have to agree. When
 * they were decided separately — the start derived from the data, the stride
 * from the span *name* — a log shorter than a year rendered "All time" as a
 * two-column sliver of 6px cells: narrower and less legible than the default
 * while showing no more data, and narrow enough that
 * {@link import('@/components/training-facility/weight-room/StrengthHeatmap').StrengthHeatmap}
 * clipped its own legend off the right edge of the SVG.
 *
 * So all-time is defined as a *superset* of the trailing year: it never starts
 * later than the default window would, and the stride shrinks only in
 * proportion to how much wider the resulting grid actually is.
 *
 * @param span The chosen span.
 * @param sets Every logged set, for the all-time start.
 * @param clock Zone each day is measured in; defaults to Pacific (#429).
 * @param now Clock reading for "today"; injectable for tests.
 */
export function heatmapWindow(
  span: HeatmapSpan,
  sets: readonly StrengthSet[],
  clock: DayClock = PACIFIC_CLOCK,
  now: Date = new Date()
): HeatmapWindow {
  if (span !== 'all') return { dateFrom: null, ...DEFAULT_CELL }

  const first = firstLoggedDate(sets, clock)
  if (first === null) return { dateFrom: null, ...DEFAULT_CELL }

  // A log that doesn't reach back past the default window has no archive to
  // reveal. Returning `null` hands the component its own trailing year, so
  // "All time" degrades to the same picture rather than to a worse one.
  const cols = columnsSince(first, clock, now)
  if (cols <= DEFAULT_COLS) return { dateFrom: null, ...DEFAULT_CELL }

  const cellSize = Math.max(
    MIN_CELL_SIZE,
    Math.min(DEFAULT_CELL.cellSize, Math.floor(ALL_TIME_TARGET_WIDTH / cols))
  )
  // A 1px gap below the default stride: 2px of a 6px cell is a third of it,
  // and the squares stop reading as squares.
  return { dateFrom: first, cellSize, cellGap: cellSize >= 10 ? 2 : 1 }
}

/**
 * Whole weeks from `start` through today, which is what the grid draws as
 * columns.
 *
 * Day keys rather than milliseconds (#319): a DST week is 23 or 25 hours long,
 * so dividing an elapsed-ms span by a week drifts twice a year.
 */
function columnsSince(start: Date, clock: DayClock, now: Date): number {
  const startKey = clock.safeDayKey(start)
  const endKey = clock.safeDayKey(now)
  if (startKey === '' || endKey === '') return DEFAULT_COLS
  const days = Math.round(
    (Date.parse(`${endKey}T12:00:00Z`) - Date.parse(`${startKey}T12:00:00Z`)) / 86_400_000
  )
  return Math.max(1, Math.ceil((days + 1) / 7))
}
