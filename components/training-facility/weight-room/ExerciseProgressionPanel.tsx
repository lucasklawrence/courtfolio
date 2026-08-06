import type { JSX } from 'react'

import { RoughLine, chartPalette } from '@/components/training-facility/shared/charts'
import { formatDayKey } from '@/lib/training-facility/day-keys'
import type {
  ExerciseDayPoint,
  ExerciseProgression,
  SetDetailCoverage,
} from '@/lib/training-facility/exercise-progression'
import { describeSet, formatLbs } from '@/lib/training-facility/strength-format'
import { E1RM_MAX_RELIABLE_REPS } from '@/lib/training-facility/workout-stats'

/** Route base for the per-exercise trend (#412). */
export const EXERCISES_ROUTE = '/training-facility/weight-room/exercises'

/**
 * Link to one movement's trend.
 *
 * @param slug Catalog slug — encoded, since it lands in the path.
 * @param isPreviewMode Carry the `?preview=demo` param through, so a preview
 *   tour doesn't dead-end on a page whose own read is empty.
 */
export function exerciseTrendHref(slug: string, isPreviewMode = false): string {
  const path = `${EXERCISES_ROUTE}/${encodeURIComponent(slug)}`
  return isPreviewMode ? `${path}?preview=demo` : path
}

/** Cream axis ink that reads on the Weight Room's dark page surface. */
const AXIS_COLOR = 'rgba(247, 234, 217, 0.55)'

/**
 * Stroke for the estimated-1RM overlay — court-line cream against the
 * movement's saturated accent, and dashed by {@link RoughLine}'s overlay
 * treatment, which reads as "computed" rather than "measured".
 */
const ESTIMATE_STROKE = chartPalette.courtLineCream

/** How many training days the recent-days table lists. */
const RECENT_DAY_ROWS = 12

/** A trend needs two anchored points; below that `scaleTime`'s domain collapses. */
const MIN_TREND_POINTS = 2

/** Props for {@link ExerciseProgressionPanel}. */
export interface ExerciseProgressionPanelProps {
  /** The movement's day-by-day history. */
  progression: ExerciseProgression
  /**
   * Human-readable movement name, resolved by the caller with `slugLabel`
   * (#384) — catalog first, then a goal's joined label, then the slug.
   */
  displayName: string
  /** What the log can't say about the years before it — rendered as a caption. */
  coverage: SetDetailCoverage
  /**
   * Line color for the measured series. Pass the movement's goal color where it
   * has one so the trend matches its heatmap and rings; defaults to rim orange
   * for the gym lifts that carry no daily goal.
   */
  accentColor?: string
  /** Chart width in px. Both panels share it so their x-axes line up. Defaults to 760. */
  width?: number
  /** Chart height in px. Defaults to 260. */
  height?: number
}

/**
 * One movement's progression over time (#412) — top set and estimated 1RM for
 * loaded work, best-set reps for bodyweight work.
 *
 * Two **separate aligned panels** rather than one dual-axis chart, per the #266
 * / #363 convention: pounds and reps are different units, and stacking them on a
 * shared y-axis invents a comparison that doesn't exist. Load and its Epley
 * estimate *do* share a unit, so those two ride the same axis — the estimate as
 * a dashed overlay, since it's derived rather than measured.
 *
 * A Server Component. `RoughLine` generates its rough.js paths without touching
 * the DOM, so there's nothing to hydrate.
 */
export function ExerciseProgressionPanel({
  progression,
  displayName,
  coverage,
  accentColor = chartPalette.rimOrange,
  width = 760,
  height = 260,
}: ExerciseProgressionPanelProps): JSX.Element {
  const { points, isBodyweight } = progression

  // The load panel spans the days the movement was actually loaded. For a
  // movement that's consistently one or the other — which is every movement in
  // this log — that's the same span as the reps panel, so the two align.
  const loadedDays = points.filter(p => p.topSet !== null)
  const estimateDays = points.filter(p => p.estimatedOneRepMax !== null)

  return (
    <div
      className="flex flex-col gap-8"
      data-testid={`exercise-progression-${progression.exercise}`}
    >
      <RecordsRow progression={progression} />

      {isBodyweight ? null : (
        <ChartCard
          title="Top set"
          subtitle={
            estimateDays.length >= MIN_TREND_POINTS
              ? 'Heaviest set each training day, with the estimated 1RM it implies'
              : 'Heaviest set each training day'
          }
        >
          <TrendChart
            data={loadedDays}
            y={p => p.topSet?.effectiveLoad ?? 0}
            overlay={
              estimateDays.length >= MIN_TREND_POINTS
                ? estimateDays.map(p => ({ x: p.date, y: p.estimatedOneRepMax ?? 0 }))
                : undefined
            }
            stroke={accentColor}
            width={width}
            height={height}
            yLabel="lb"
            yTickFormat={value => String(Math.round(value))}
            ariaLabel={`${displayName} heaviest set in pounds across ${loadedDays.length} training days`}
            emptyMessage={`Not enough loaded ${displayName} days yet`}
          />
          <EstimateNote progression={progression} plotted={estimateDays.length} />
        </ChartCard>
      )}

      <ChartCard
        title="Best set"
        subtitle={
          isBodyweight
            ? 'Most reps in a single set each training day'
            : 'Most reps in a single set each training day — the other half of the same work'
        }
      >
        <TrendChart
          data={points}
          y={p => p.bestRepSet.reps}
          stroke={isBodyweight ? accentColor : chartPalette.hardwoodTan}
          width={width}
          height={height}
          yLabel="reps"
          yTickFormat={value => String(Math.round(value))}
          ariaLabel={`${displayName} best set in reps across ${points.length} training days`}
          emptyMessage={`Not enough ${displayName} training days yet`}
        />
      </ChartCard>

      <CoverageNote progression={progression} displayName={displayName} coverage={coverage} />
      <RecentDaysTable progression={progression} displayName={displayName} />
    </div>
  )
}

/** Props for the shared chart wrapper. */
interface ChartCardProps {
  /** Panel heading. */
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
          a year of training days into 350 px. */}
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  )
}

/** Props for {@link TrendChart}. */
interface TrendChartProps {
  /** Days to plot, oldest first. */
  data: readonly ExerciseDayPoint[]
  /** The value to plot for a day. */
  y: (point: ExerciseDayPoint) => number
  /** Optional derived series drawn dashed over the same axis. */
  overlay?: { x: Date; y: number }[]
  /** Measured-series stroke. */
  stroke: string
  /** Chart width in px. */
  width: number
  /** Chart height in px. */
  height: number
  /** Left-axis unit label. */
  yLabel: string
  /** Tick formatter for the left axis. */
  yTickFormat: (value: number) => string
  /** Accessible name for the chart. */
  ariaLabel: string
  /** Shown in place of the plot when there aren't two days to connect. */
  emptyMessage: string
}

/**
 * One measured series, optionally with a derived overlay.
 *
 * Below two points there is no trend to draw — `scaleTime` collapses to a
 * zero-width domain — so the empty state renders instead. Expected while a
 * movement is new, not an error.
 */
function TrendChart({
  data,
  y,
  overlay,
  stroke,
  width,
  height,
  yLabel,
  yTickFormat,
  ariaLabel,
  emptyMessage,
}: TrendChartProps): JSX.Element {
  const plottable = data.length >= MIN_TREND_POINTS ? [...data] : []
  return (
    <RoughLine
      data={plottable}
      x={p => p.date}
      y={y}
      overlay={plottable.length === 0 ? undefined : overlay}
      overlayStroke={ESTIMATE_STROKE}
      width={width}
      height={height}
      stroke={stroke}
      axisColor={AXIS_COLOR}
      yLabel={yLabel}
      yTickFormat={yTickFormat}
      ariaLabel={ariaLabel}
      emptyMessage={emptyMessage}
    />
  )
}

/** Props for {@link RecordsRow}. */
interface RecordsRowProps {
  /** The movement's history. */
  progression: ExerciseProgression
}

/** All-time marks: heaviest set, most reps, best estimate, days trained. */
function RecordsRow({ progression }: RecordsRowProps): JSX.Element {
  const { heaviestSet, mostRepsSet, bestOneRepMax, points, totalSets, totalReps } = progression
  return (
    <dl
      data-testid="exercise-records"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      aria-label="All-time marks"
    >
      {heaviestSet === null ? null : (
        <RecordCell
          label="Heaviest set"
          value={describeSet(heaviestSet.reps, heaviestSet.effectiveLoad)}
        />
      )}
      <RecordCell label="Most reps" value={`${mostRepsSet.reps} reps`} />
      {bestOneRepMax === null ? null : (
        <RecordCell
          label="Best est. 1RM"
          value={`~${formatLbs(bestOneRepMax)}`}
          title={`Epley estimate from a set of ${E1RM_MAX_RELIABLE_REPS} reps or fewer`}
        />
      )}
      <RecordCell
        label="Training days"
        value={String(points.length)}
        detail={`${totalSets.toLocaleString('en-US')} sets · ${totalReps.toLocaleString('en-US')} reps`}
      />
    </dl>
  )
}

/** Props for one record tile. */
interface RecordCellProps {
  /** What the number is. */
  label: string
  /** The number itself. */
  value: string
  /** Optional smaller line beneath the value. */
  detail?: string
  /** Optional hover explanation. */
  title?: string
}

/** One all-time mark. */
function RecordCell({ label, value, detail, title }: RecordCellProps): JSX.Element {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3" title={title}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#e8d5be]/60">
        {label}
      </dt>
      <dd className="mt-1.5 text-lg font-black tabular-nums text-[#fff7ec]">{value}</dd>
      {detail === undefined ? null : (
        <dd className="mt-0.5 font-mono text-[10px] tracking-[0.12em] text-[#e8d5be]/50">
          {detail}
        </dd>
      )}
    </div>
  )
}

/** Props for {@link EstimateNote}. */
interface EstimateNoteProps {
  /** The movement's history. */
  progression: ExerciseProgression
  /** How many days made it onto the estimate overlay. */
  plotted: number
}

/**
 * Say why the estimate line is missing, when it is.
 *
 * A loaded movement trained entirely at 20–25 reps has an Epley number for every
 * set and no business plotting any of them. Stating that — with the count — is
 * more honest than an absent line, and more honest than a dashed one the caption
 * would have to walk back.
 */
function EstimateNote({ progression, plotted }: EstimateNoteProps): JSX.Element | null {
  if (plotted >= MIN_TREND_POINTS) {
    return (
      <p className="mt-3 text-xs leading-6 text-[#e8d5be]/60">
        <span className="mr-1.5 inline-block h-px w-6 translate-y-[-3px] border-t border-dashed border-[#f5f1e6]/70 align-middle" />
        Dashed: estimated 1RM (Epley), from sets of {E1RM_MAX_RELIABLE_REPS} reps or fewer.
      </p>
    )
  }

  if (progression.loadedSets === 0) return null

  const noneReliable = progression.highRepLoadedSets === progression.loadedSets
  return (
    <p data-testid="exercise-estimate-note" className="mt-3 text-xs leading-6 text-[#e8d5be]/60">
      {noneReliable
        ? `No estimated 1RM line: all ${progression.loadedSets} loaded sets ran above ${E1RM_MAX_RELIABLE_REPS} reps, and Epley drifts too high past that to plot as a measurement.`
        : `Not enough low-rep sets to trend an estimated 1RM yet — ${progression.loadedSets - progression.highRepLoadedSets} of ${progression.loadedSets} loaded sets came in at or under ${E1RM_MAX_RELIABLE_REPS} reps.`}
    </p>
  )
}

/** Props for {@link CoverageNote}. */
interface CoverageNoteProps {
  /** The movement's history. */
  progression: ExerciseProgression
  /** Human-readable movement name. */
  displayName: string
  /** Sessions predating it that carry no set detail. */
  coverage: SetDetailCoverage
}

/**
 * State what the x-axis doesn't cover.
 *
 * The chart starts at the first *recorded set*, which is not when the training
 * started — 507 imported Apple Health sessions going back to 2018 record
 * duration and heart rate and nothing else (#413). Left unsaid, a two-month axis
 * reads as a two-month training history. Absence here is a true statement about
 * the log, not missing data to hide.
 */
function CoverageNote({ progression, displayName, coverage }: CoverageNoteProps): JSX.Element {
  const firstDay = progression.points[0]?.dayKey
  const since =
    firstDay === undefined
      ? 'the first recorded set'
      : formatDayKey(firstDay, { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <p
      data-testid="exercise-coverage-note"
      className="rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-[#e8d5be]/65"
    >
      Set-level detail for {displayName} begins {since}.
      {coverage.sessionsBefore > 0 && coverage.earliestSessionDayKey !== null ? (
        <>
          {' '}
          {coverage.sessionsBefore.toLocaleString('en-US')} earlier sessions — back to{' '}
          {formatDayKey(coverage.earliestSessionDayKey, {
            month: 'long',
            year: 'numeric',
          })}{' '}
          — were imported from Apple Health, which records that a workout happened and for how long,
          never what was done in it. The training predates the writing-it-down; the chart can only
          show the part that was written down.
        </>
      ) : null}
    </p>
  )
}

/** Props for {@link RecentDaysTable}. */
interface RecentDaysTableProps {
  /** The movement's history. */
  progression: ExerciseProgression
  /** Human-readable movement name. */
  displayName: string
}

/**
 * The most recent training days as numbers.
 *
 * The charts show shape; this shows values, and it's what a screen reader gets
 * instead of an `aria-label` summarizing a path it can't traverse.
 */
function RecentDaysTable({ progression, displayName }: RecentDaysTableProps): JSX.Element {
  const recent = [...progression.points].reverse().slice(0, RECENT_DAY_ROWS)
  const showLoad = !progression.isBodyweight

  return (
    <section
      aria-label={`Recent ${displayName} training days`}
      data-testid="exercise-recent-days"
      className="overflow-x-auto rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
    >
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <caption className="px-5 pt-5 text-left font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#0a0a0a]/60">
          Last {recent.length} training {recent.length === 1 ? 'day' : 'days'}
        </caption>
        <thead>
          <tr className="border-b border-black/10 text-left font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[#0a0a0a]/55">
            <th scope="col" className="px-5 py-2.5 font-normal">
              Day
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-normal">
              Sets
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-normal">
              Reps
            </th>
            <th scope="col" className="px-5 py-2.5 text-right font-normal">
              {showLoad ? 'Top set' : 'Best set'}
            </th>
          </tr>
        </thead>
        <tbody>
          {recent.map(point => (
            <tr
              key={point.dayKey}
              data-testid={`exercise-day-${point.dayKey}`}
              className="border-b border-black/5 last:border-0"
            >
              <th scope="row" className="px-5 py-2.5 text-left font-semibold">
                {formatDayKey(point.dayKey, { month: 'short', day: 'numeric', year: 'numeric' })}
              </th>
              <td className="px-3 py-2.5 text-right tabular-nums">{point.sets}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{point.reps}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">
                {point.topSet === null
                  ? `${point.bestRepSet.reps} reps`
                  : describeSet(point.topSet.reps, point.topSet.effectiveLoad)}
                {point.estimatedOneRepMax === null ? null : (
                  <span className="block text-[0.7rem] text-[#0a0a0a]/55">
                    ~{formatLbs(point.estimatedOneRepMax)} est. 1RM
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
