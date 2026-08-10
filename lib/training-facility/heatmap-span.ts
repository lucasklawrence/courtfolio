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

/**
 * Where a heatmap should start drawing.
 *
 * @param span The chosen span.
 * @param sets Every logged set, for the all-time start.
 * @param clock Zone each day is measured in; defaults to Pacific (#429).
 * @returns The window start, or `null` to leave the component on its own
 *   trailing-year default. Null is also the answer for an all-time view of an
 *   empty log — there is no history to widen to.
 */
export function heatmapWindowStart(
  span: HeatmapSpan,
  sets: readonly StrengthSet[],
  clock: DayClock = PACIFIC_CLOCK
): Date | null {
  return span === 'all' ? firstLoggedDate(sets, clock) : null
}

/**
 * Cell stride for a span, in pixels.
 *
 * The log runs to ~232 columns, which at the default 14px stride is over
 * 3,000px per heatmap. The card scrolls horizontally, so that renders — but the
 * point of an all-time view is the *shape*: where the gaps are, where the
 * density is, and shape read through a quarter-width window is no shape at all.
 *
 * Nothing legible fits the ~900px content column outright — that would need a
 * 4px stride — so this is a panning budget, not a fit. 6px puts the whole log
 * in about one and a half screens with cells still individually visible, where
 * 8px needs two and the default needs three and a half.
 *
 * @param span The chosen span.
 * @returns `{ cellSize, cellGap }` to hand the heatmap.
 */
export function heatmapCellMetrics(span: HeatmapSpan): { cellSize: number; cellGap: number } {
  return span === 'all' ? { cellSize: 6, cellGap: 1 } : { cellSize: 14, cellGap: 2 }
}
