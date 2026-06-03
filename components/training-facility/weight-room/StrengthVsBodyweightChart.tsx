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
  )
}
