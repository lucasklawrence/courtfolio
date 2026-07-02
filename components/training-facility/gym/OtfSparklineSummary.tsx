import type { JSX } from 'react'

import { RoughSparkline } from '@/components/training-facility/shared/charts/RoughSparkline'
import { otfTrendEndpoints, type OtfTrendPoint } from '@/lib/training-facility/otf'

const SPARK_WIDTH = 150
const SPARK_HEIGHT = 30

/**
 * One metric row in a machine's sparkline summary (#266): its trend plus how to
 * label and format it. Each row keeps its own y-scale — the summary compares
 * *direction over time*, not magnitudes across rows.
 */
export interface OtfSparklineRow {
  /** Stable React key. */
  key: string
  /** Row label, e.g. "Distance". */
  label: string
  /** Raw `{date, value}` points, ascending (already range-filtered). */
  trend: OtfTrendPoint[]
  /** Format an absolute value with its unit, e.g. ``v => `${Math.round(v)} m` `` or `formatMmss`. */
  format: (value: number) => string
}

/** Props for {@link OtfSparklineSummary}. */
export interface OtfSparklineSummaryProps {
  /** The metrics to summarize, one sparkline row each. */
  rows: OtfSparklineRow[]
  /** Prefixes each sparkline's accessible name, e.g. "Rower" → "Rower distance trend". */
  ariaLabelPrefix: string
}

/**
 * Aligned small-multiples summary for a machine (#256/#266): one tiny trend per
 * metric, each true to its own units and y-scale, stacked on a shared date
 * x-axis with the `first → latest` values beside it. The chosen alternative to
 * a normalized overlay — an honest at-a-glance scan of where each metric is
 * heading, without cross-metric distortion.
 *
 * Used for the rower and treadmill summary cards in {@link OtfDetailView}.
 */
export function OtfSparklineSummary({ rows, ariaLabelPrefix }: OtfSparklineSummaryProps): JSX.Element {
  // One shared x-domain (min→max class date across every row) so points line up
  // by date down the column — a dip in the same week reads across rows.
  let minMs = Infinity
  let maxMs = -Infinity
  for (const row of rows) {
    for (const p of row.trend) {
      const ms = p.date.getTime()
      if (ms < minMs) minMs = ms
      if (ms > maxMs) maxMs = ms
    }
  }
  const xDomain: [number, number] | undefined =
    Number.isFinite(minMs) && Number.isFinite(maxMs) ? [minMs, maxMs] : undefined

  return (
    <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-4 gap-y-3 text-[#0a0a0a]">
      {rows.map(row => {
        const ends = otfTrendEndpoints(row.trend)
        const rangeText = ends
          ? ends.first === ends.last
            ? row.format(ends.first)
            : `${row.format(ends.first)} → ${row.format(ends.last)}`
          : 'no data'
        return (
          <div key={row.key} className="contents">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#404040]">
              {row.label}
            </span>
            {ends ? (
              <RoughSparkline
                points={row.trend.map(p => ({ x: p.date.getTime(), y: p.value }))}
                xDomain={xDomain}
                width={SPARK_WIDTH}
                height={SPARK_HEIGHT}
                ariaLabel={`${ariaLabelPrefix} ${row.label.toLowerCase()} trend, ${rangeText}`}
              />
            ) : (
              <span
                aria-hidden="true"
                className="inline-block h-[1px] bg-[#0a0a0a]/15"
                style={{ width: SPARK_WIDTH }}
              />
            )}
            <span className="text-right font-mono text-xs text-[#0a0a0a]">{rangeText}</span>
          </div>
        )
      })}
    </div>
  )
}
