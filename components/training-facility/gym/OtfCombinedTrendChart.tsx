import type { JSX } from 'react'

import { RoughMultiLine } from '@/components/training-facility/shared/charts/RoughMultiLine'
import { defaultMargin } from '@/components/training-facility/shared/charts/types'
import { normalizeOtfTrend, type OtfTrendPoint } from '@/lib/training-facility/otf'

const CHART_HEIGHT = 280
const FONT_FAMILY = "'Patrick Hand', system-ui, sans-serif"

/**
 * One metric line in a combined machine chart (#266): a raw trend plus how to
 * label and color it. The chart normalizes each series to its own range, so
 * absolute values survive only in the legend via {@link OtfCombinedSeries.format}.
 */
export interface OtfCombinedSeries {
  /** Stable React key + legend list key. */
  key: string
  /** Legend label and part of the chart's accessible name (e.g. "Distance"). */
  label: string
  /** Line + swatch color. */
  color: string
  /** Raw `{date, value}` points for this metric (already range-filtered). */
  trend: OtfTrendPoint[]
  /**
   * Render an absolute value with its unit for the legend range, e.g.
   * ``v => `${Math.round(v)} m` `` or `formatMmss` for a pace/split.
   */
  format: (value: number) => string
}

/** Props for {@link OtfCombinedTrendChart}. */
export interface OtfCombinedTrendChartProps {
  /** The metrics to overlay. Empty-trend series still appear in the legend as "no data". */
  series: OtfCombinedSeries[]
  /** Chart width in px (the detail view feeds its measured chart width). */
  width: number
  /** Accessible name for the chart. */
  ariaLabel: string
  /** Placeholder text when no series has any data in range. */
  emptyMessage: string
}

/**
 * Overlays several of a machine's metrics on one chart (#256/#266) by
 * normalizing each to its own min–max so they share a single 0–100% axis —
 * the "are these moving together?" read the issue asks for. Absolute values,
 * which normalization discards, are surfaced per-series in the legend below
 * the chart (min → max with units).
 *
 * Used for the rower (distance / time / avg watts) and treadmill
 * (distance / time / avg pace) combined cards in {@link OtfDetailView}.
 */
export function OtfCombinedTrendChart({
  series,
  width,
  ariaLabel,
  emptyMessage,
}: OtfCombinedTrendChartProps): JSX.Element {
  const normalized = series.map(s => ({ spec: s, norm: normalizeOtfTrend(s.trend) }))

  const lines = normalized.map(({ spec, norm }) => ({
    label: spec.label,
    color: spec.color,
    points: norm.points.map(p => ({ x: p.date, y: p.value })),
  }))

  return (
    <div>
      <RoughMultiLine
        series={lines}
        width={width}
        height={CHART_HEIGHT}
        margin={defaultMargin}
        fontFamily={FONT_FAMILY}
        yDomain={[0, 1]}
        yTickCount={5}
        yTickFormat={v => `${Math.round(v * 100)}%`}
        yLabel="% of range"
        ariaLabel={ariaLabel}
        emptyMessage={emptyMessage}
      />
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#0a0a0a]">
        {normalized.map(({ spec, norm }) => (
          <li key={spec.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: spec.color }}
            />
            <span className="font-semibold">{spec.label}</span>
            <span className="font-mono text-[#404040]">{rangeLabel(spec, norm.min, norm.max)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Legend range text for one series: the absolute min → max, a single value
 * when the range is flat (or one class), or "no data" when the metric is
 * absent across every class in range.
 */
function rangeLabel(
  spec: OtfCombinedSeries,
  min: number,
  max: number
): string {
  if (spec.trend.length === 0) return 'no data'
  if (min === max) return spec.format(min)
  return `${spec.format(min)} → ${spec.format(max)}`
}
