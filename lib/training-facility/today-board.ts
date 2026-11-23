import type { ExerciseGoal, MonthlyFocus, WeightRoomData } from '@/types/weight-room'

import { exerciseLabel } from './exercise-labels'
import { currentTarget } from './goal-targets'
import { streakFromDailyReps } from './hit-day-streaks'
import { activeFocusesForDay, goalsVisibleOnDay } from './monthly-focus'
import { countedReps } from './set-reps'
import { toLocalDateKey } from './strength-today'
import { PACIFIC_CLOCK } from './clock'

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
 * The target `goal` is held to today. A focus goal uses the rotation active today
 * when that rotation counts reps; a sets-based rotation's target isn't comparable
 * to a rep total, so it falls through. Everything else uses `currentTarget`, not
 * `targetForDay`, so a scheduled change can't show before it arrives.
 */
function targetToday(goal: ExerciseGoal, active: MonthlyFocus | undefined, dayKey: string): number {
  if (goal.kind === 'focus' && active && active.target_kind !== 'sets' && active.daily_target > 0) {
    return active.daily_target
  }
  return currentTarget(goal, dayKey)
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
  const goals = goalsVisibleOnDay(data.goals, focuses, dayKey)
  const repsByExercise = new Map<string, Map<string, number>>()
  for (const set of data.sets) {
    const day = PACIFIC_CLOCK.safeDayKey(set.logged_at)
    if (!day) continue
    const days = repsByExercise.get(set.exercise) ?? new Map<string, number>()
    days.set(day, (days.get(day) ?? 0) + countedReps(set))
    repsByExercise.set(set.exercise, days)
  }

  return goals.map(goal => {
    // Use the same window-aware rule for the ring and every streak day. An
    // ended nested rotation must not keep setting the bar after its window.
    // `find` preserves the documented upper-lane precedence for duplicate goals.
    const targetOnDay = (day: string): number => {
      const active = activeFocusesForDay(focuses, day).find(f => f.exercise === goal.exercise)
      if (goal.kind === 'focus' && !active) return Infinity
      return targetToday(goal, active, day)
    }
    const days = repsByExercise.get(goal.exercise) ?? new Map<string, number>()
    return {
      goal: { ...goal, daily_target: targetOnDay(dayKey) },
      label: exerciseLabel(goal),
      total: days.get(dayKey) ?? 0,
      streak: streakFromDailyReps(days, targetOnDay, dayKey).current,
    }
  })
}
