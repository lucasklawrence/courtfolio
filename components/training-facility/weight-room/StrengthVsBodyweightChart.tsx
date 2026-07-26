'use client'

import type { JSX } from 'react'

import { BodyweightOverlay, RoughLine } from '@/components/training-facility/shared/charts'
import { buildWeeklyVolume } from '@/lib/training-facility/weight-room-history'
import type { CardioTimePoint } from '@/types/cardio'
import type { Benchmark } from '@/types/movement'
import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/** Cream axis ink that reads on the Weight Room's dark card surface. */
const AXIS_COLOR = 'rgba(247, 234, 217, 0.6)'

/**
 * Stroke for the bodyweight series — court-line cream, a neutral that
 * reads as the *secondary* metric against the exercise's saturated
 * primary color (orange/teal). The overlay also dashes it, so the two
 * lines never get confused even at a glance.
 */
const BODYWEIGHT_STROKE = '#F5F1E6'

/** Props for {@link StrengthVsBodyweightChart}. */
export interface StrengthVsBodyweightChartProps {
  /**
   * Every logged set across all exercises; filtered to {@link goal}'s
   * exercise internally, so callers pass the full `WeightRoomData.sets`
   * list once — mirroring the other Weight Room chart components.
   */
  sets: readonly StrengthSet[]
  /** The exercise to chart as the primary (left-axis) series. */
  goal: ExerciseGoal
  /**
   * Morning bodyweight trend in **pounds** — the cardio dataset's
   * `body_mass_trend` (one point per day, latest-wins). Plotted as the
   * secondary right-axis series. Empty/absent is fine: the overlay
   * disables its toggle and only the primary line renders.
   */
  bodyMass: readonly CardioTimePoint[]
  /**
   * Trailing weeks to consider before trimming leading empty weeks.
   * Defaults to 52 (a year) so the relationship has room to show.
   */
  weeks?: number
  /** Pixel width of the chart. Defaults to 760. */
  width?: number
  /** Pixel height of the chart. Defaults to 280. */
  height?: number
}

/**
 * Weekly rep volume for one exercise (primary, left axis) with morning
 * bodyweight overlaid (secondary, right axis) — the History view's
 * relative-strength showpiece. For a bodyweight movement like pull-ups,
 * volume climbing while bodyweight falls is improvement on two fronts at
 * once, a story neither the heatmap nor the single-axis volume bars can
 * tell.
 *
 * A Client Component because {@link BodyweightOverlay} is — it owns a
 * show/hide toggle and defers its rough.js layer to post-hydration to
 * dodge an SSR/client generator-state mismatch. The primary
 * {@link RoughLine} renders immediately.
 *
 * The primary line's x-domain is `[firstWeek, lastWeek]` (RoughLine
 * derives it from the data extent); the overlay is handed the same
 * `dateExtent` so the two x-axes line up exactly. Leading empty weeks
 * are trimmed so the line starts at the first logged week instead of
 * dragging a flat run of zeros across half the chart.
 */
export function StrengthVsBodyweightChart({
  sets,
  goal,
  bodyMass,
  weeks = 52,
  width = 760,
  height = 280,
}: StrengthVsBodyweightChartProps): JSX.Element {
  // Drop the in-progress current week (the last column buildWeeklyVolume
  // emits): until it fills in it always plots as a drop toward zero,
  // which reads as a decline rather than the partial week it is. Only
  // completed weeks make an honest trend.
  const completed = buildWeeklyVolume(sets, goal, weeks).slice(0, -1)
  const firstActive = completed.findIndex(p => p.reps > 0)
  const points = firstActive === -1 ? [] : completed.slice(firstActive)

  // A trend needs two anchored weeks; below that, scaleTime's domain
  // collapses and the overlay can't align. Fall back to the empty-state
  // line so the section never renders a broken chart. (Expected while the
  // log is young — it fills in once two weeks are complete.)
  if (points.length < 2) {
    return (
      <RoughLine
        data={[]}
        x={() => 0}
        y={() => 0}
        width={width}
        height={height}
        axisColor={AXIS_COLOR}
        emptyMessage={`Not enough completed weeks of ${goal.exercise} yet`}
        ariaLabel={`${goal.exercise} weekly volume — not enough completed weeks yet`}
      />
    )
  }

  const dateExtent: [Date, Date] = [points[0].weekStart, points[points.length - 1].weekStart]

  // Adapt the cardio trend points into the Benchmark shape the overlay
  // consumes — only `date` and `bodyweight_lbs` are read, and a missing
  // `is_complete` defaults to complete.
  const benchmarks: Benchmark[] = bodyMass
    .filter(p => Number.isFinite(p.value))
    .map(p => ({ date: p.date, bodyweight_lbs: p.value }))

  return (
    <div style={{ width }}>
      <BodyweightOverlay
        benchmarks={benchmarks}
        dateExtent={dateExtent}
        width={width}
        height={height}
        stroke={BODYWEIGHT_STROKE}
        axisColor={AXIS_COLOR}
        ariaLabel={`Morning bodyweight in pounds overlaid on weekly ${goal.exercise} volume`}
      >
        <RoughLine
          data={points}
          x={p => p.weekStart}
          y={p => p.reps}
          width={width}
          height={height}
          stroke={goal.color}
          axisColor={AXIS_COLOR}
          yLabel={`${goal.exercise}/wk`}
          ariaLabel={`Weekly ${goal.exercise} volume over ${points.length} weeks`}
        />
      </BodyweightOverlay>
      <ChartLegend exercise={goal.exercise} exerciseColor={goal.color} />
    </div>
  )
}

/**
 * Names the two series. Two lines on two different y-axes are only readable if
 * you know which is which, and the axis labels alone don't carry that at a
 * glance — the left axis reads `pullups/wk`, the right `Bodyweight (lbs)`, but
 * neither says which *line* is which.
 *
 * Sits below the plot rather than inside it: the overlay owns an absolutely
 * positioned toggle in the top-right corner, and an in-plot legend would have
 * to dodge it at every width.
 *
 * Static by design. It labels the encoding; it isn't a control. Hiding the
 * bodyweight line is what the overlay's own toggle is for, and mirroring that
 * state here would imply the legend is clickable too.
 */
function ChartLegend({
  exercise,
  exerciseColor,
}: {
  exercise: string
  exerciseColor: string
}): JSX.Element {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#f7ead9]/70">
      <LegendKey color={exerciseColor} label={`${exercise} / week`} />
      {/* Dashed to match how BodyweightOverlay strokes the secondary series. */}
      <LegendKey color={BODYWEIGHT_STROKE} label="Bodyweight (lb)" dashed />
    </ul>
  )
}

/** One legend row: a line swatch in the series' own stroke, then its name. */
function LegendKey({
  color,
  label,
  dashed = false,
}: {
  color: string
  label: string
  dashed?: boolean
}): JSX.Element {
  return (
    <li className="flex items-center gap-2">
      {/* `aria-hidden` — the adjacent text already names the series, so a
          screen reader would otherwise hear an unlabeled graphic. */}
      <svg aria-hidden="true" width={22} height={8} viewBox="0 0 22 8">
        <line
          x1={0}
          y1={4}
          x2={22}
          y2={4}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
      {label}
    </li>
  )
}
