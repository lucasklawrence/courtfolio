import type { ExerciseGoal, WeightRoomData } from '@/types/weight-room'

import { exerciseLabel } from './exercise-labels'
import { targetForDay } from './goal-targets'
import { goalsVisibleOnDay } from './monthly-focus'
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
  /** Current streak in days; `0` when there is none or the clock isn't known yet. */
  streak: number
}

/**
 * Reduce the Weight Room dataset to the rows on today's board: which goals
 * appear, what each one's target is today, and how far along it is. The wall
 * fixture and the phone panel both draw from this, so they can't disagree about
 * what today's board says.
 *
 * @param data The Weight Room dataset; `null` while nothing has loaded.
 * @param now The viewer's clock, or `null` before mount. Without a clock the
 *   board shows permanent goals at zero, because no focus window can be tested.
 */
export function buildTodayBoard(
  data: WeightRoomData | null | undefined,
  now: Date | null
): TodayBoardRow[] {
  if (!data) return []

  const dayKey = now ? toLocalDateKey(now) : ''
  const goals = goalsVisibleOnDay(data.goals, data.monthly_focus ?? [], dayKey)
  const totals = totalsByExercise(dayKey ? filterSetsForDay(data.sets, dayKey) : [])
  const streaks = now ? computeStrengthStreaks(data.sets, goals, now) : {}

  return goals.map(goal => ({
    goal: { ...goal, daily_target: targetForDay(goal, dayKey) },
    label: exerciseLabel(goal),
    total: totals.get(goal.exercise) ?? 0,
    streak: streaks[goal.exercise]?.current ?? 0,
  }))
}
