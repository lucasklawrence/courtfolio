import type { JSX } from 'react'

import { RoughBar } from '@/components/training-facility/shared/charts'
import { buildWeeklyVolume } from '@/lib/training-facility/weight-room-history'
import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/** Cream axis ink that reads on the Weight Room's dark card surface. */
const AXIS_COLOR = 'rgba(247, 234, 217, 0.55)'

/** Props for {@link WeeklyVolumeChart}. */
export interface WeeklyVolumeChartProps {
  /**
   * Every logged set across all exercises; the chart filters down to
   * {@link goal}'s exercise internally, so callers pass the full
   * `WeightRoomData.sets` list once per exercise — mirroring
   * {@link import('./StrengthHeatmap').StrengthHeatmap}.
   */
  sets: readonly StrengthSet[]
  /** The exercise to chart — supplies the bar color and exercise filter. */
  goal: ExerciseGoal
  /** Trailing weeks to show, including the current one. Defaults to 12. */
  weeks?: number
  /** SVG height in px. Defaults to 220. */
  height?: number
}

/**
 * Weekly rep-volume bar chart for one exercise (#216 follow-up). Sits
 * beneath that exercise's {@link import('./StrengthHeatmap').StrengthHeatmap}
 * on the History view: the heatmap shows daily consistency, this shows
 * the magnitude trend the heatmap's capped color scale can't — "am I
 * doing more reps per week than I was a quarter ago?".
 *
 * A pure Server Component — `buildWeeklyVolume` is a synchronous reduce
 * and `RoughBar` renders rough.js paths server-side (the generator never
 * touches the DOM), so no client boundary is needed.
 *
 * The SVG is a fixed pixel width sized to the week count so bars stay a
 * consistent stride; the History page wraps it in `overflow-x-auto` so
 * the full series scrolls on a phone rather than squashing.
 */
export function WeeklyVolumeChart({
  sets,
  goal,
  weeks = 12,
  height = 220,
}: WeeklyVolumeChartProps): JSX.Element {
  const points = buildWeeklyVolume(sets, goal, weeks)
  // ~56px per bar keeps the M/D labels from colliding; the 96px pad
  // covers the left y-axis gutter and right margin.
  const width = Math.max(480, points.length * 56 + 96)
  const weeklyGoal = Math.max(1, goal.daily_target) * 7

  return (
    <RoughBar
      data={points}
      x={p => p.label}
      y={p => p.reps}
      width={width}
      height={height}
      fill={goal.color}
      stroke={goal.color}
      axisColor={AXIS_COLOR}
      yLabel="reps"
      ariaLabel={`${goal.exercise} weekly volume over the last ${points.length} weeks (weekly goal ${weeklyGoal} reps)`}
      emptyMessage="No sets logged yet"
    />
  )
}
