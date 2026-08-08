import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import { PACIFIC_CLOCK, type DayClock } from './clock'
import { targetResolverFor } from './goal-targets'
import { type StreakCounts, streakFromDailyReps } from './hit-day-streaks'

/**
 * Per-exercise streak result, mirrored on
 * {@link import('./streaks').StreakResult} so the UI surfaces can stay
 * shape-compatible across cardio and weight-room. "Goal hit" here means
 * the exercise's total reps for the day reached the target that was in
 * effect *on that day*, resolved from the goal's effective-dated history
 * (#362) — so raising or lowering a target never re-scores days already
 * completed.
 *
 * Structurally identical to {@link StreakCounts}, which is what the shared
 * computation returns; kept as its own name because the cardio-side
 * `StreakResult` pairing is what makes the two UI surfaces interchangeable.
 */
export type StrengthStreakResult = StreakCounts

/**
 * Compute streaks for every configured exercise. Returns a record
 * keyed by exercise name; exercises with no logged sets (yet) still
 * appear with `{ current: 0, longest: 0 }` so callers can render a
 * full row of `StreakBadge`s without juggling fallbacks.
 *
 * "Hit the goal" means the exercise's total reps for that calendar
 * day reach the target in effect on that day (#362). Multiple sets on
 * the same day sum together; the goal applies to the day, not per-set.
 *
 * The "current" streak counts back from today (or yesterday if no
 * goal-hit set has been logged today yet) and is `0` when the most
 * recent goal-hit day is older than yesterday — same convention as
 * {@link import('./streaks').computeStreaks} so the cross-area UX is
 * coherent.
 *
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param goals All configured exercises, usually `WeightRoomData.goals`.
 *   Streaks are only computed for goals whose current `daily_target > 0`;
 *   non-positive targets short-circuit to `{ current: 0, longest: 0 }`.
 *   Each day's bar comes from the goal's `target_history` when present.
 * @param now The clock used to derive "today" / "yesterday." Defaults
 *   to `new Date()`. Pass an explicit value from the viewer's clock
 *   when calling from a server-rendered surface so server-side UTC
 *   doesn't disagree with the visitor's local timezone (#197).
 * @param clock Zone the day buckets are measured in; defaults to Pacific (#429).
 */
export function computeStrengthStreaks(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
  now: Date = new Date(),
  clock: DayClock = PACIFIC_CLOCK
): Record<string, StrengthStreakResult> {
  const result: Record<string, StrengthStreakResult> = {}

  // Bucket reps by exercise -> day -> running total. Uses Maps to keep
  // the inner structure ordered insertion-wise; the shared streak helper
  // sorts keys explicitly so the input order doesn't matter.
  const repsByExerciseAndDay = new Map<string, Map<string, number>>()
  for (const s of sets) {
    const day = clock.safeDayKey(s.logged_at)
    if (day === '') continue
    let dayMap = repsByExerciseAndDay.get(s.exercise)
    if (!dayMap) {
      dayMap = new Map()
      repsByExerciseAndDay.set(s.exercise, dayMap)
    }
    dayMap.set(day, (dayMap.get(day) ?? 0) + s.reps)
  }

  const todayKey = clock.dayKey(now)

  for (const goal of goals) {
    if (goal.daily_target <= 0) {
      result[goal.exercise] = { current: 0, longest: 0 }
      continue
    }
    const dayMap = repsByExerciseAndDay.get(goal.exercise) ?? new Map<string, number>()
    // Per-day target resolution (#362) — bound once per goal so the history
    // is sorted a single time rather than once per logged day.
    result[goal.exercise] = streakFromDailyReps(dayMap, targetResolverFor(goal), todayKey)
  }

  return result
}
