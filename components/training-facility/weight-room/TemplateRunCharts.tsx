import type { JSX } from 'react'

import { RoughLine, chartPalette } from '@/components/training-facility/shared/charts'
import { formatDayKey } from '@/lib/training-facility/day-keys'
import type { TemplateHistory, TemplateRunPoint } from '@/lib/training-facility/template-history'

/** Cream axis ink that reads on the Weight Room's dark page surface. */
const AXIS_COLOR = 'rgba(247, 234, 217, 0.55)'

/** A trend needs two anchored points; below that `scaleTime`'s domain collapses. */
const MIN_TREND_POINTS = 2

/** Chart geometry, matching the per-movement trends (#412). */
const CHART_WIDTH = 760
const CHART_HEIGHT = 240

/** Props for {@link TemplateRunCharts}. */
export interface TemplateRunChartsProps {
  /** The template's aggregated run history. */
  history: TemplateHistory
  /** Line color; defaults to the template's own chip color where it has one. */
  accentColor?: string
}

/**
 * Whole-workout trends for one template (#446) — how the *session* is going,
 * rather than any single movement in it.
 *
 * Three series, each answering a different question about the same runs:
 * tonnage (is the work going up), volume (is that more sets or heavier ones),
 * and duration (is it taking longer to do it).
 *
 * A Server Component; rough.js emits its paths without a DOM.
 */
export function TemplateRunCharts({ history, accentColor }: TemplateRunChartsProps): JSX.Element {
  const stroke = accentColor ?? chartPalette.rimOrange
  const { runs, durations } = history

  if (runs.length < MIN_TREND_POINTS) {
    return (
      <p
        data-testid="template-single-run-note"
        className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-[#e8d5be]/75"
      >
        {runs.length === 0
          ? 'No sessions have run this workout yet.'
          : 'Ran once so far — a second session is what turns these numbers into a trend.'}
      </p>
    )
  }

  return (
    <div className="space-y-6" data-testid="template-run-charts">
      <ChartCard
        title="Tonnage per session"
        subtitle="Total load moved each time this workout ran. The clearest single read on whether the session is progressing."
      >
        <RunChart
          data={runs}
          y={run => run.tonnage}
          stroke={stroke}
          yLabel="lb"
          yTickFormat={value => `${Math.round(value / 1000)}k`}
          ariaLabel={`${history.template.name} tonnage per session`}
        />
      </ChartCard>

      <ChartCard
        title="Volume per session"
        subtitle="Sets and reps recorded each run. Read against tonnage: rising load on flat volume is heavier work, not more of it."
      >
        {/* Two charts on a shared x-axis rather than two series on a shared
            y-axis. Reps run an order of magnitude above sets, so overlaying
            them flattens the set line into a smear along the baseline — the
            same trap the OTF machine card avoided (#266). */}
        <div className="flex flex-col gap-4">
          <RunChart
            data={runs}
            y={run => run.totalReps}
            stroke={stroke}
            yLabel="reps"
            yTickFormat={value => String(Math.round(value))}
            ariaLabel={`${history.template.name} reps per session`}
          />
          <RunChart
            data={runs}
            y={run => run.totalSets}
            stroke={stroke}
            yLabel="sets"
            yTickFormat={value => String(Math.round(value))}
            ariaLabel={`${history.template.name} sets per session`}
          />
        </div>
      </ChartCard>

      {durations.length >= MIN_TREND_POINTS ? (
        <ChartCard
          title="Duration per session"
          subtitle="Wall-clock minutes, from sessions that recorded a real one."
        >
          <RunChart
            data={durations}
            y={run => run.durationMinutes ?? 0}
            stroke={stroke}
            yLabel="min"
            yTickFormat={value => String(Math.round(value))}
            ariaLabel={`${history.template.name} duration per session`}
          />
          {durations.length < runs.length ? (
            <p className="mt-3 text-xs leading-5 text-[#e8d5be]/60">
              {runs.length - durations.length} of {runs.length} runs are left out: their start and
              end times come from when a note was written, not from the session itself.
            </p>
          ) : null}
        </ChartCard>
      ) : null}
    </div>
  )
}

/** Props for {@link ChartCard}. */
interface ChartCardProps {
  /** Short, all-caps section label. */
  title: string
  /** One line saying what the series actually is. */
  subtitle: string
  /** The chart, plus any note beneath it. */
  children: React.ReactNode
}

/** Titled, horizontally scrollable frame around one chart. */
function ChartCard({ title, subtitle, children }: ChartCardProps): JSX.Element {
  return (
    <section className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-[#e8d5be]/75">{subtitle}</p>
      {/* Fixed-width SVG: the page scrolls it on a phone rather than squashing
          a year of sessions into 350 px. */}
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  )
}

/** Props for {@link RunChart}. */
interface RunChartProps {
  /** Runs to plot, oldest first. */
  data: readonly TemplateRunPoint[]
  /** The value to plot for a run. */
  y: (run: TemplateRunPoint) => number
  /** Line color. */
  stroke: string
  /** Left-axis unit label. */
  yLabel: string
  /** Tick formatter for the left axis. */
  yTickFormat: (value: number) => string
  /** Accessible name for the chart. */
  ariaLabel: string
}

/** One session-over-session line, on a shared time axis. */
function RunChart({ data, y, stroke, yLabel, yTickFormat, ariaLabel }: RunChartProps): JSX.Element {
  return (
    <RoughLine
      data={[...data]}
      x={run => run.date}
      y={y}
      stroke={stroke}
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      yLabel={yLabel}
      yTickFormat={yTickFormat}
      xTickFormat={tick => formatDayKey(toDayKey(tick), { month: 'short', year: '2-digit' })}
      axisColor={AXIS_COLOR}
      ariaLabel={ariaLabel}
    />
  )
}

/**
 * A tick value from the time axis as a `YYYY-MM-DD` key.
 *
 * The points are built at Pacific noon, so the calendar fields of the tick are
 * already the right day — reading them back through `toISOString` would shift
 * a UTC-rendered server onto the wrong side of midnight.
 */
function toDayKey(tick: Date | number): string {
  const date = tick instanceof Date ? tick : new Date(tick)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
