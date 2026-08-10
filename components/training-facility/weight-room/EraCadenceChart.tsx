import type { JSX } from 'react'

import { RoughBar, chartPalette } from '@/components/training-facility/shared/charts'
import type { EraMonth } from '@/lib/training-facility/log-eras'

/** Cream axis ink that reads on the Weight Room's dark page surface. */
const AXIS_COLOR = 'rgba(247, 234, 217, 0.55)'

/** Pixels per month column, sized so a five-year span stays legible when scrolled. */
const MONTH_WIDTH = 20

/** Props for {@link EraCadenceChart}. */
export interface EraCadenceChartProps {
  /** Every month from the log's first to its last, gaps included. */
  months: readonly EraMonth[]
  /** Chart height in px. */
  height?: number
}

/**
 * The `YYYY-MM` bounds of the layoff, or `null` when there isn't one.
 *
 * Named explicitly beneath the chart because the gap is drawn as a run of
 * zero-height bars — deliberately still present on the axis, so a month with no
 * training reads as "none" rather than vanishing — and a long flat stretch is
 * suggestive rather than precise.
 */
function gapBounds(months: readonly EraMonth[]): { from: string; to: string } | null {
  const gaps = months.filter(month => month.era === 'gap')
  const first = gaps[0]
  const last = gaps[gaps.length - 1]
  if (first === undefined || last === undefined) return null
  return { from: first.monthKey, to: last.monthKey }
}

/**
 * Training days per month across the whole log (#437).
 *
 * The one requirement that shapes everything: **the layoff has to occupy
 * space**. `buildLogEras` emits every calendar month between the first and last
 * training day, including the ~25 empty ones, and this draws them all — so the
 * gap is a visibly empty stretch of axis rather than two eras rendered
 * shoulder to shoulder.
 *
 * A bar per month rather than a line for the same reason: a line drawn across
 * the layoff would imply a continuous quantity declining through it, when what
 * actually happened is that nothing was logged at all.
 *
 * A Server Component; rough.js emits its paths without a DOM.
 */
export function EraCadenceChart({ months, height = 220 }: EraCadenceChartProps): JSX.Element {
  const width = Math.max(560, months.length * MONTH_WIDTH + 96)
  const gap = gapBounds(months)

  return (
    <section
      data-testid="era-cadence"
      className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-5"
    >
      <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
        Days trained per month
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-[#e8d5be]/75">
        Every month between the first logged set and the last. The empty stretch in the middle is
        the layoff — drawn rather than skipped, because a chart that closed the gap would say the
        two eras ran back to back.
      </p>

      <div className="mt-4 overflow-x-auto">
        <RoughBar
          data={[...months]}
          x={month => month.monthKey}
          y={month => month.trainingDays}
          fill={chartPalette.rimOrange}
          stroke={chartPalette.rimOrange}
          fillStyle="hachure"
          width={width}
          height={height}
          // Only January carries a label, plus the first month so the axis
          // opens with a date. Naming all ~54 months renders them as one
          // illegible smear.
          xTickLabel={(monthKey, index) =>
            index === 0 || monthKey.endsWith('-01') ? monthKey.slice(0, 4) : null
          }
          yLabel="days"
          yTickFormat={value => String(Math.round(value))}
          axisColor={AXIS_COLOR}
          ariaLabel="Days trained per month across the whole log"
        />
      </div>

      {gap === null ? null : (
        <p data-testid="era-gap-note" className="mt-3 text-xs leading-5 text-[#e8d5be]/60">
          Nothing logged from {gap.from} through {gap.to} — {monthCount(months)} months of the span
          with no training recorded.
        </p>
      )}
    </section>
  )
}

/** How many months of the span carry no training at all. */
function monthCount(months: readonly EraMonth[]): number {
  return months.filter(month => month.era === 'gap').length
}
