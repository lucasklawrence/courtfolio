import type { ExerciseGoal, MonthlyFocus, StrengthSet } from '@/types/weight-room'

import { PACIFIC_CLOCK, type DayClock } from './clock'
import { targetForDay, targetResolverFor } from './goal-targets'
import { activeFocusesForDay } from './monthly-focus'
import { countedReps } from './set-reps'

/**
 * The single rule for "what bar did this goal have to clear on this day, and
 * in what unit", shared by the Today board, the Log view, the History stats
 * and the Trophy Room's streak tiers.
 *
 * Those four surfaces used to answer it separately and disagreed in three
 * ways: a sets-based rotation was scored against a rep total (or not scored
 * at all), a nested rotation kept setting the bar after its window closed, and
 * a day between two rotations of a focus exercise counted against the previous
 * rotation's target on one surface and against nothing on another.
 */

/** Unit a day's volume is measured in: total reps, or distinct logged sets. */
export type VolumeUnit = 'reps' | 'sets'

/** The bar a goal is held to on one day. */
export interface DayTarget {
  /** Volume needed to count the day as a hit, in {@link unit}. Always `>= 1`. */
  target: number
  /** Whether {@link target} counts reps or distinct sets. */
  unit: VolumeUnit
}

/** One exercise's logged volume on one day, in both units. */
export interface DayVolume {
  /** Reps summed over the day's sets; a set with no recorded count adds 0. */
  reps: number
  /** Distinct sets logged that day, including ones with no recorded count. */
  sets: number
}

/**
 * Read a day's volume in the unit its target asks for.
 *
 * @param volume The day's volume; `undefined` (nothing logged) reads as 0.
 * @param unit The unit to read.
 */
export function volumeIn(volume: DayVolume | undefined, unit: VolumeUnit): number {
  if (volume === undefined) return 0
  return unit === 'sets' ? volume.sets : volume.reps
}

/**
 * Bucket sets into `exercise → day key → volume`, in both units at once so a
 * caller can score reps-based and sets-based targets from one pass.
 *
 * @param sets All logged sets; ones whose timestamp won't parse are skipped.
 * @param clock Zone the day buckets are measured in; defaults to Pacific.
 */
export function dailyVolumeByExercise(
  sets: readonly StrengthSet[],
  clock: DayClock = PACIFIC_CLOCK
): Map<string, Map<string, DayVolume>> {
  const byExercise = new Map<string, Map<string, DayVolume>>()
  for (const s of sets) {
    const day = clock.safeDayKey(s.logged_at)
    if (day === '') continue
    let days = byExercise.get(s.exercise)
    if (!days) {
      days = new Map()
      byExercise.set(s.exercise, days)
    }
    const entry = days.get(day) ?? { reps: 0, sets: 0 }
    entry.reps += countedReps(s)
    entry.sets += 1
    days.set(day, entry)
  }
  return byExercise
}

/**
 * Bind the per-day scoring rule to one goal.
 *
 * - A **permanent** goal (or one with no `kind`) is held to its own
 *   effective-dated rep target every day, via `baseTarget`.
 * - A **focus** goal with rotation windows is held to whichever rotation is
 *   active for its exercise that day, in that rotation's unit. "Active"
 *   follows {@link activeFocusesForDay}: within a body-region lane the most
 *   recently started window wins, so a nested rotation supersedes its parent
 *   only for its own window. A day no window covers has no bar (`null`), so
 *   off-campaign sets never extend a focus streak.
 * - A focus goal whose exercise has no window at all falls back to
 *   `baseTarget`, so a caller that doesn't pass rotations still gets the
 *   anchor goal's scalar rather than a goal that can never be hit.
 * - A rotation with a non-positive target also falls back to `baseTarget`.
 *
 * @param goal The goal to score.
 * @param focuses Every configured rotation, across exercises and lanes. All of
 *   them are needed, not just this exercise's, because another exercise's
 *   window in the same lane can supersede this one.
 * @param baseTarget Resolves the goal's own rep target on a day. Defaults to
 *   the effective-dated history ({@link targetResolverFor}); the Today board
 *   passes `currentTarget` so a scheduled change can't show before its day.
 * @returns A function from day key to that day's {@link DayTarget}, or `null`
 *   when the goal has no bar on that day.
 */
export function goalDayTargetResolver(
  goal: ExerciseGoal,
  focuses: readonly MonthlyFocus[],
  baseTarget: (dayKey: string) => number = targetResolverFor(goal)
): (dayKey: string) => DayTarget | null {
  const base = (dayKey: string): DayTarget => ({
    target: Math.max(1, baseTarget(dayKey)),
    unit: 'reps',
  })
  const hasWindows = focuses.some(f => f.exercise === goal.exercise)
  if (goal.kind !== 'focus' || !hasWindows) return base

  return (dayKey: string) => {
    // `find` keeps the upper-lane-first precedence when the same exercise
    // somehow runs in both lanes at once.
    const active = activeFocusesForDay(focuses, dayKey).find(f => f.exercise === goal.exercise)
    if (active === undefined) return null
    if (active.daily_target <= 0) return base(dayKey)
    return { target: active.daily_target, unit: active.target_kind }
  }
}

/**
 * The target a stats card labels a goal with today.
 *
 * Today's rule when the goal has a bar today. Otherwise, for a focus exercise
 * between or after rotations, the most recent rotation that has started (or
 * the first one, when every window is still ahead), so an ended campaign's
 * card still says what it was chasing. A permanent goal always has a bar.
 *
 * @param goal The goal to label.
 * @param focuses Every configured rotation.
 * @param todayKey Today's day key.
 */
export function labelTargetForToday(
  goal: ExerciseGoal,
  focuses: readonly MonthlyFocus[],
  todayKey: string
): DayTarget {
  const today = goalDayTargetResolver(goal, focuses)(todayKey)
  if (today !== null) return today

  const windows = focuses
    .filter(f => f.exercise === goal.exercise && f.daily_target > 0)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0))
  const started = windows.filter(f => f.start_date <= todayKey)
  const pick = started[started.length - 1] ?? windows[0]
  if (pick === undefined) return { target: targetForDay(goal, todayKey), unit: 'reps' }
  return { target: pick.daily_target, unit: pick.target_kind }
}
