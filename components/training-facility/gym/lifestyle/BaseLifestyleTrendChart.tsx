import { useMemo, type JSX } from 'react'

import { RoughLine } from '@/components/training-facility/shared/charts/RoughLine'
import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import { defaultMargin } from '@/components/training-facility/shared/charts/types'
import { parseSessionDate } from '@/lib/training-facility/cardio-shared'
import type { CardioTimePoint } from '@/types/cardio'

/**
 * Props for {@link BaseLifestyleTrendChart}. The 6 named wrappers in this
 * folder fix the metric-specific labels / formats / messages and pass the
 * shared range + presentation knobs through.
 */
export interface BaseLifestyleTrendChartProps {
  /**
   * Daily-trend points for the metric. `undefined` (preprocessor /
   * Supabase table empty) is treated identically to "no points in
   * range" — both render the empty-state via {@link RoughLine}'s
   * `emptyMessage` path.
   */
  points: readonly CardioTimePoint[] | undefined
  /** Inclusive lower bound from the parent's `DateFilter`; omit for "all-time." */
  dateFrom?: Date | null
  /** Inclusive upper bound from the parent's `DateFilter`; defaults to no clamp. */
  dateTo?: Date | null
  /** Pixel width of the SVG; the parent's `ResizeObserver` drives this. */
  width: number
  /** Pixel height of the SVG. Defaults to 220 to match neighboring cards. */
  height?: number
  /** Font family for axes / empty-state copy. */
  fontFamily?: string
  /** Y-axis label drawn on the left margin (units in parens, e.g. `"HRV (ms)"`). */
  yLabel: string
  /** Formatter for y-axis tick labels — sleep gets `1.toFixed(1)`, steps get `toLocaleString()`, etc. */
  yTickFormat?: (value: number) => string
  /** Caption shown when {@link points} is empty / undefined / fully clipped out. */
  emptyMessage: string
  /** Accessible label for the wrapping `<svg role="img">`. */
  ariaLabel: string
}

/**
 * Shared props shape for the six per-metric wrappers (`HrvTrendChart`,
 * `WalkingHrTrendChart`, `BodyMassTrendChart`, `StepCountTrendChart`,
 * `SleepTrendChart`, `ActiveEnergyTrendChart`). Each wrapper supplies
 * the metric-specific `yLabel` / `yTickFormat` / `emptyMessage` /
 * `ariaLabel` itself; the call site only deals with `points` + range +
 * presentation. Lives next to {@link BaseLifestyleTrendChartProps}
 * (#178 follow-up) so the shared shape isn't keyed off one wrapper's
 * file by historical accident.
 */
export type LifestyleChartProps = Omit<
  BaseLifestyleTrendChartProps,
  'yLabel' | 'yTickFormat' | 'emptyMessage' | 'ariaLabel'
>

const DEFAULT_HEIGHT = 220

/**
 * Generic daily-trend chart used by every lifestyle-metric wrapper. Clips the
 * input series to the active `DateFilter` range, then delegates to
 * {@link RoughLine} for the actual sketch (which handles its own empty-state
 * fallback). The 6 wrappers in this folder are intentionally one-liners on
 * top of this base so a future cross-cutting tweak — hover tooltips, area
 * fills, dual-line overlays — lands in one place rather than six.
 *
 * Date clipping happens HERE rather than at the call site so each wrapper
 * stays declarative ("show HRV", "show sleep") and the call site doesn't
 * have to repeat the same `points.filter(p => parseSessionDate(p.date) ...)`
 * incantation six times.
 */
export function BaseLifestyleTrendChart({
  points,
  dateFrom,
  dateTo,
  width,
  height = DEFAULT_HEIGHT,
  fontFamily,
  yLabel,
  yTickFormat,
  emptyMessage,
  ariaLabel,
}: BaseLifestyleTrendChartProps): JSX.Element {
  // Memoize the clip so we don't re-walk the full daily series on
  // every parent re-render (a typical year is ~365 points; modest at
  // best, but `useMemo` is free here and the parent's `sharedProps`
  // change identity often). #178 follow-up.
  const clipped = useMemo(
    () => clipToRange(points ?? [], dateFrom ?? null, dateTo ?? null),
    [points, dateFrom, dateTo],
  )

  return (
    <RoughLine<TrendPoint>
      data={clipped}
      x={(p) => p.date}
      y={(p) => p.value}
      width={width}
      height={height}
      margin={defaultMargin}
      fontFamily={fontFamily}
      axisColor={chartPalette.inkSoft}
      yLabel={yLabel}
      yTickFormat={yTickFormat}
      ariaLabel={ariaLabel}
      emptyMessage={emptyMessage}
    />
  )
}

/** Internal point shape after parsing the ISO date — `RoughLine` accepts `Date` for time scales. */
interface TrendPoint {
  date: Date
  value: number
}

/**
 * Clip a `CardioTimePoint[]` series to the optional inclusive range and
 * pre-parse the date strings into `Date`s so {@link RoughLine}'s time-scale
 * branch picks them up. Points whose date doesn't parse are dropped silently
 * — they'd render as NaN-positioned dots otherwise.
 */
function clipToRange(
  points: readonly CardioTimePoint[],
  dateFrom: Date | null,
  dateTo: Date | null,
): TrendPoint[] {
  const fromMs = dateFrom?.getTime() ?? -Infinity
  const toMs = dateTo?.getTime() ?? Infinity
  const out: TrendPoint[] = []
  for (const p of points) {
    const d = parseSessionDate(p.date)
    const t = d.getTime()
    if (!Number.isFinite(t)) continue
    if (t < fromMs || t > toMs) continue
    out.push({ date: d, value: p.value })
  }
  return out
}
