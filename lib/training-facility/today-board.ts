import type { ExerciseGoal, MonthlyFocus, WeightRoomData } from '@/types/weight-room'

import { exerciseLabel } from './exercise-labels'
import { currentTarget } from './goal-targets'
import { activeFocusesForDay, focusTargetHistory, goalsVisibleOnDay } from './monthly-focus'
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
 * The goal as its streak should score it. A focus goal's bar is its rotations'
 * targets rather than the anchor's scalar (#367). A goal whose whole history is
 * still ahead keeps its current target for past days too, so a scheduled change
 * can't break a streak before it arrives.
 */
function streakGoal(
  goal: ExerciseGoal,
  focuses: readonly MonthlyFocus[],
  dayKey: string
): ExerciseGoal {
  if (goal.kind === 'focus') {
    const rotations = focusTargetHistory(focuses, goal.exercise)
    if (rotations.length > 0) return { ...goal, target_history: rotations }
  }
  const history = goal.target_history
  const allAhead = history !== undefined && history.every(p => p.effective_from > dayKey)
  return allAhead ? { ...goal, target_history: undefined } : goal
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
  const active = new Map(activeFocusesForDay(focuses, dayKey).map(f => [f.exercise, f]))
  const totals = totalsByExercise(filterSetsForDay(data.sets, dayKey))
  const streaks = computeStrengthStreaks(
    data.sets,
    goals.map(goal => streakGoal(goal, focuses, dayKey)),
    now
  )

  return goals.map(goal => ({
    goal: { ...goal, daily_target: targetToday(goal, active.get(goal.exercise), dayKey) },
    label: exerciseLabel(goal),
    total: totals.get(goal.exercise) ?? 0,
    streak: streaks[goal.exercise]?.current ?? 0,
  }))
}
