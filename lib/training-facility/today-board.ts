import type { ExerciseGoal, WeightRoomData } from '@/types/weight-room'

import { exerciseLabel } from './exercise-labels'
import {
  type VolumeUnit,
  dailyVolumeByExercise,
  goalDayTargetResolver,
  volumeIn,
} from './focus-scoring'
import { currentTarget } from './goal-targets'
import { streakFromDailyVolume } from './hit-day-streaks'
import { goalsVisibleOnDay } from './monthly-focus'
import { toDayKey } from './strength-today'
import { PACIFIC_CLOCK } from './clock'

/** One goal's standing on the public Today board. */
export interface TodayBoardRow {
  /** The goal, with `daily_target` already resolved to the target live today, in {@link unit}. */
  goal: ExerciseGoal
  /** Display name to draw; `goal.exercise` stays the identity for keys and test ids. */
  label: string
  /** Volume logged today, in {@link unit}. */
  total: number
  /**
   * What {@link total} and `goal.daily_target` count: reps, or distinct sets
   * for a goal whose active rotation is sets-based.
   */
  unit: VolumeUnit
  /** Current streak in days; `0` when there is none. */
  streak: number
}

/**
 * Reduce the Weight Room dataset to the rows on today's board: which goals
 * appear, what each one's target is today, and how far along it is. The wall
 * fixture and the phone panel both draw these rows, so they can't disagree about
 * what today's board says.
 *
 * Each day, the ring and every streak day alike, is scored by
 * `goalDayTargetResolver`, the same rule the Log, History and Trophy Room use.
 * A permanent goal's own target comes from `currentTarget`, not `targetForDay`,
 * so a scheduled change can't show before it arrives.
 *
 * Day keys are Pacific regardless of where this runs, so the page computes this
 * on the server and sends the browser only the rows, not the whole set history.
 *
 * @param data The Weight Room dataset; `null` when nothing could be read.
 * @param now The moment to treat as today.
 */
export function buildTodayBoard(
  data: WeightRoomData | null | undefined,
  now: Date
): TodayBoardRow[] {
  if (!data) return []

  const dayKey = toDayKey(now)
  const focuses = data.monthly_focus ?? []
  const goals = goalsVisibleOnDay(data.goals, focuses, dayKey)
  const volumeByExercise = dailyVolumeByExercise(data.sets, PACIFIC_CLOCK)

  return goals.flatMap(goal => {
    const targetOnDay = goalDayTargetResolver(goal, focuses, day => currentTarget(goal, day))
    const today = targetOnDay(dayKey)
    // `goalsVisibleOnDay` only admits a focus goal while a window covers today,
    // so this is unreachable unless the two disagree; skip rather than draw a
    // ring with no bar.
    if (today === null) return []
    const days = volumeByExercise.get(goal.exercise) ?? new Map()
    return [
      {
        goal: { ...goal, daily_target: today.target },
        label: exerciseLabel(goal),
        total: volumeIn(days.get(dayKey), today.unit),
        unit: today.unit,
        streak: streakFromDailyVolume(days, targetOnDay, dayKey).current,
      },
    ]
  })
}
