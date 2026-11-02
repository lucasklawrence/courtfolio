import type { ExerciseGoal, WeightRoomData } from '@/types/weight-room'

import { exerciseLabel } from './exercise-labels'
import { currentTarget } from './goal-targets'
import { goalsVisibleOnDay, withFocusTargets } from './monthly-focus'
import { computeStrengthStreaks } from './strength-streaks'
import { filterSetsForDay, toLocalDateKey, totalsByExercise } from './strength-today'

/** One goal's standing on the public Today board. */
export interface TodayBoardRow {
  /** The goal, with `daily_target` already resolved to the target live today. */
  goal: ExerciseGoal
  /** Display name to draw; `goal.exercise` stays the identity for keys and test ids. */
  label: string
  /** Reps logged today. */
  total: number
  /** Current streak in days; `0` when there is none. */
  streak: number
}

/**
 * Reduce the Weight Room dataset to the rows on today's board: which goals
 * appear, what each one's target is today, and how far along it is. The wall
 * fixture and the phone panel both draw these rows, so they can't disagree about
 * what today's board says.
 *
 * Day keys are Pacific regardless of where this runs, so the page computes this
 * on the server and sends the browser only the rows, not the whole set history.
 *
 * Targets use `currentTarget`, not `targetForDay`: a goal whose whole history is
 * future-dated must keep its current target until the scheduled change arrives.
 *
 * @param data The Weight Room dataset; `null` when nothing could be read.
 * @param now The moment to treat as today.
 */
export function buildTodayBoard(
  data: WeightRoomData | null | undefined,
  now: Date
): TodayBoardRow[] {
  if (!data) return []

  const dayKey = toLocalDateKey(now)
  const focuses = data.monthly_focus ?? []
  const goals = withFocusTargets(goalsVisibleOnDay(data.goals, focuses, dayKey), focuses)
  const totals = totalsByExercise(filterSetsForDay(data.sets, dayKey))
  const streaks = computeStrengthStreaks(data.sets, goals, now)

  return goals.map(goal => ({
    goal: { ...goal, daily_target: currentTarget(goal, dayKey) },
    label: exerciseLabel(goal),
    total: totals.get(goal.exercise) ?? 0,
    streak: streaks[goal.exercise]?.current ?? 0,
  }))
}
