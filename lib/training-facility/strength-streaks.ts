import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import { toLocalDateKey } from './strength-today'

/**
 * Per-exercise streak result, mirrored on
 * {@link import('./streaks').StreakResult} so the UI surfaces can stay
 * shape-compatible across cardio and weight-room. "Goal hit" here means
 * the exercise's total reps for the day reached
 * {@link ExerciseGoal.daily_target} — note that historical changes to
 * the target aren't tracked, so the streak is computed against today's
 * configured target across the entire history (best we can do without
 * a target-history table).
 */
export interface StrengthStreakResult {
  /**
   * Length in days of the active goal-hit streak ending at today, or
   * yesterday if today's target hasn't been hit yet. `0` when the most
   * recent goal-hit day is older than yesterday.
   */
  current: number
  /**
   * Longest run of consecutive calendar days that hit the goal, ever.
   * Independent of {@link current}.
   */
  longest: number
}

/**
 * Add `n` days to a `YYYY-MM-DD` key, returning a new key. Local-noon
 * base time so DST transitions don't shift the calendar day.
 */
function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toLocalDateKey(d)
}

/**
 * Compute streaks for every configured exercise. Returns a record
 * keyed by exercise name; exercises with no logged sets (yet) still
 * appear with `{ current: 0, longest: 0 }` so callers can render a
 * full row of `StreakBadge`s without juggling fallbacks.
 *
 * "Hit the goal" means the exercise's total reps for that calendar
 * day reach {@link ExerciseGoal.daily_target}. Multiple sets on the
 * same day sum together; the goal applies to the day, not per-set.
 *
 * The "current" streak counts back from today (or yesterday if no
 * goal-hit set has been logged today yet) and is `0` when the most
 * recent goal-hit day is older than yesterday — same convention as
 * {@link import('./streaks').computeStreaks} so the cross-area UX is
 * coherent.
 *
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param goals All configured exercises, usually `WeightRoomData.goals`.
 *   Streaks are only computed for goals whose `daily_target > 0`;
 *   non-positive targets short-circuit to `{ current: 0, longest: 0 }`.
 * @param now The clock used to derive "today" / "yesterday." Defaults
 *   to `new Date()`. Pass an explicit value from the viewer's clock
 *   when calling from a server-rendered surface so server-side UTC
 *   doesn't disagree with the visitor's local timezone (#197).
 */
export function computeStrengthStreaks(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
  now: Date = new Date(),
): Record<string, StrengthStreakResult> {
  const result: Record<string, StrengthStreakResult> = {}

  // Bucket reps by exercise → day → running total. Uses Maps to keep
  // the inner structure ordered insertion-wise; the streak loop sorts
  // keys explicitly so the input order doesn't matter.
  const repsByExerciseAndDay = new Map<string, Map<string, number>>()
  for (const s of sets) {
    const day = toLocalDateKey(s.logged_at)
    if (day === '') continue
    let dayMap = repsByExerciseAndDay.get(s.exercise)
    if (!dayMap) {
      dayMap = new Map()
      repsByExerciseAndDay.set(s.exercise, dayMap)
    }
    dayMap.set(day, (dayMap.get(day) ?? 0) + s.reps)
  }

  const today = toLocalDateKey(now)
  const yesterday = today === '' ? '' : addDays(today, -1)

  for (const goal of goals) {
    if (goal.daily_target <= 0) {
      result[goal.exercise] = { current: 0, longest: 0 }
      continue
    }
    const dayMap = repsByExerciseAndDay.get(goal.exercise) ?? new Map<string, number>()

    // "Goal-hit" calendar days, in chronological order.
    const hitDays: string[] = []
    for (const [day, total] of dayMap) {
      if (total >= goal.daily_target) hitDays.push(day)
    }
    hitDays.sort()

    if (hitDays.length === 0) {
      result[goal.exercise] = { current: 0, longest: 0 }
      continue
    }

    // Longest run of consecutive goal-hit days, ever.
    let longest = 1
    let run = 1
    for (let i = 1; i < hitDays.length; i++) {
      if (addDays(hitDays[i - 1], 1) === hitDays[i]) {
        run++
        if (run > longest) longest = run
      } else {
        run = 1
      }
    }

    // Current streak: walk backward from the latest goal-hit day if
    // it's today or yesterday (matches `computeStreaks`'s rolling-day
    // grace period).
    const last = hitDays[hitDays.length - 1]
    let current = 0
    if (last === today || last === yesterday) {
      current = 1
      for (let i = hitDays.length - 2; i >= 0; i--) {
        if (addDays(hitDays[i], 1) === hitDays[i + 1]) {
          current++
        } else {
          break
        }
      }
    }

    result[goal.exercise] = {
      current,
      longest: Math.max(longest, current),
    }
  }

  return result
}
