import { shiftDayKey } from './day-keys'

/**
 * The one implementation of "consecutive days that cleared the daily target"
 * (#366).
 *
 * This lived in two places — `weight-room-history.ts` (one goal, returns
 * `{ current, longest }`) and `strength-streaks.ts` (all goals, returns a
 * record) — with identical logic and different day-key conventions. #362 had
 * to make the same effective-dated edit in both copies, which is the usual
 * sign the logic should be shared. Consolidating was blocked until #319 gave
 * both call sites one day-key convention: with the arithmetic no longer
 * varying, the only thing left to inject is the per-day target.
 */

/** Consecutive-day counts for one exercise. */
export interface StreakCounts {
  /**
   * Length of the active run ending today, or yesterday when today hasn't
   * cleared the bar yet. `0` when the most recent qualifying day is older
   * than yesterday.
   *
   * The one-day grace matters: without it a streak would appear broken every
   * morning until that day's first set landed.
   */
  current: number
  /** Longest run of consecutive qualifying days, ever. Independent of {@link current}. */
  longest: number
}

/**
 * Count streaks from an ascending-sortable set of qualifying day keys.
 *
 * @param hitDays Day keys that cleared the bar, any order — sorted internally.
 * @param todayKey `YYYY-MM-DD` anchor for the today/yesterday grace period.
 *   Pass `''` (an unparseable clock) to get `current: 0` with `longest` still
 *   computed, rather than a spurious streak.
 */
export function streakFromHitDays(
  hitDays: readonly string[],
  todayKey: string,
): StreakCounts {
  if (hitDays.length === 0) return { current: 0, longest: 0 }

  const days = [...hitDays].sort()

  let longest = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    if (shiftDayKey(days[i - 1], 1) === days[i]) {
      run++
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  const last = days[days.length - 1]
  const yesterdayKey = todayKey === '' ? '' : shiftDayKey(todayKey, -1)
  if (todayKey === '' || (last !== todayKey && last !== yesterdayKey)) {
    return { current: 0, longest }
  }

  let current = 1
  for (let i = days.length - 2; i >= 0; i--) {
    if (shiftDayKey(days[i], 1) === days[i + 1]) current++
    else break
  }

  return { current, longest: Math.max(longest, current) }
}

/**
 * Count streaks from a `day key → reps` map, testing each day against the
 * target that was in effect *that* day.
 *
 * @param dailyReps Reps summed per day key.
 * @param targetFor Resolves the target in effect on a day key — from
 *   `targetResolverFor`. Taking a resolver rather than a scalar is what makes
 *   the hit-test effective-dated (#362); it already clamps non-positive
 *   targets to `1`, so the predicate can't invert.
 * @param todayKey `YYYY-MM-DD` anchor for the grace period.
 */
export function streakFromDailyReps(
  dailyReps: ReadonlyMap<string, number>,
  targetFor: (dayKey: string) => number,
  todayKey: string,
): StreakCounts {
  const hitDays: string[] = []
  for (const [key, reps] of dailyReps) {
    if (reps >= targetFor(key)) hitDays.push(key)
  }
  return streakFromHitDays(hitDays, todayKey)
}
