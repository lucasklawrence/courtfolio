import type { StrengthSet, WeightRoomExercise, WeightRoomWorkout } from '@/types/weight-room'

import { PACIFIC_CLOCK, type DayClock } from './clock'
import { workoutDayKey } from './workout-sessions'
import {
  E1RM_MAX_RELIABLE_REPS,
  effectiveSetLoad,
  epleyOneRepMax,
  loadMultipliersBySlug,
  type WorkoutSetHighlight,
} from './workout-stats'

/**
 * One movement's progression over time (#412) — the exercise-altitude companion
 * to `workout-stats.ts`.
 *
 * That module answers "how did tonight's session go". This one answers "is the
 * bench going up", which is a different unit of analysis: a movement's history
 * runs across sessions, and — in this log — mostly *outside* them. Every set on
 * record today is loose grease-the-groove logging with no `workout_id`, so a
 * per-session trend would plot nothing at all. The unit here is therefore the
 * **training day**: it holds loose sets and session sets alike, and a session
 * recorded through #376 lands in its own day without special-casing. Which
 * calendar day that is comes from the caller's {@link DayClock} — Pacific for
 * this site, the client's own zone for a consumer serving other people (#429).
 *
 * Pure and isomorphic, like its sibling — no Supabase client, no React, and no
 * wall clock beyond the zone it's handed. The arithmetic that misleads when
 * it's wrong (what counts as the top set, which estimates are worth plotting)
 * is unit-testable rather than only observable by squinting at a chart.
 */

/** One training day's worth of a single movement. */
export interface ExerciseDayPoint {
  /** Calendar day key in the caller's clock zone, `YYYY-MM-DD`. */
  dayKey: string
  /**
   * Noon on {@link dayKey} in the clock's zone, as the chart's x value. Noon rather than
   * midnight so a DST boundary can't shunt a point onto the adjacent day.
   */
  date: Date
  /** Sets of this movement logged that day. */
  sets: number
  /** Reps across those sets. */
  reps: number
  /** `Σ reps × effective load` for the day; `0` when every set was bodyweight. */
  tonnage: number
  /**
   * Heaviest set of the day by effective load, ties broken toward more reps.
   * `null` when the movement was performed bodyweight — the common case in this
   * log, not an edge case.
   */
  topSet: WorkoutSetHighlight | null
  /** Most reps in a single set that day. Never `null` — every day has sets. */
  bestRepSet: WorkoutSetHighlight
  /**
   * Best Epley estimate of the day, computed **only** from sets at or under
   * {@link E1RM_MAX_RELIABLE_REPS}. `null` when the day has no such set, which
   * includes every all-bodyweight day and every day of high-rep loaded work.
   *
   * Deliberately not "the estimate off {@link topSet}": a heavy set of 20 has an
   * Epley number, but plotting it puts a figure the formula cannot support on a
   * line the eye reads as measurement. Absence is the honest rendering, and the
   * UI explains it rather than drawing a line it would have to disclaim.
   */
  estimatedOneRepMax: number | null
}

/** A movement's whole recorded history, bucketed by training day. */
export interface ExerciseProgression {
  /**
   * Catalog slug — the stored identity, and the URL token.
   *
   * No display label here on purpose: a movement can outlive its catalog row's
   * label or carry one joined onto a goal instead (#384), so the render site
   * resolves it with `slugLabel` from the sources it holds. Baking one in would
   * give a second, staler answer.
   */
  exercise: string
  /** Training days, oldest first. Never empty — see {@link buildExerciseProgression}. */
  points: ExerciseDayPoint[]
  /** Whether no set of this movement has ever carried external load. */
  isBodyweight: boolean
  /** Sets logged, all time. */
  totalSets: number
  /** Reps logged, all time. */
  totalReps: number
  /** How many of {@link totalSets} carried external load. */
  loadedSets: number
  /**
   * Loaded sets above {@link E1RM_MAX_RELIABLE_REPS}. Surfaced so the UI can say
   * *why* a loaded movement has no estimate line — "66 loaded sets, none under
   * 12 reps" is a fact about the training, not a gap in the chart.
   */
  highRepLoadedSets: number
  /** Heaviest set ever, ties toward more reps; `null` for a bodyweight movement. */
  heaviestSet: WorkoutSetHighlight | null
  /** Most reps in one set ever, ties toward heavier load. */
  mostRepsSet: WorkoutSetHighlight
  /**
   * Best estimate across every reliable set, or `null` when there is none. Same
   * cutoff rule as {@link ExerciseDayPoint.estimatedOneRepMax}.
   */
  bestOneRepMax: number | null
}

/**
 * Pick the heavier of two sets, ties toward more reps.
 *
 * @returns `candidate` when it wins, otherwise `best` — which stays `null` while
 *   every set seen so far was bodyweight.
 */
function heavier(
  best: WorkoutSetHighlight | null,
  candidate: WorkoutSetHighlight
): WorkoutSetHighlight | null {
  if (candidate.effectiveLoad <= 0) return best
  if (best === null) return candidate
  if (candidate.effectiveLoad > best.effectiveLoad) return candidate
  if (candidate.effectiveLoad === best.effectiveLoad && candidate.reps > best.reps) return candidate
  return best
}

/** Pick the higher-rep of two sets, ties toward heavier load. */
function repsier(
  best: WorkoutSetHighlight | null,
  candidate: WorkoutSetHighlight
): WorkoutSetHighlight {
  if (best === null) return candidate
  if (candidate.reps > best.reps) return candidate
  if (candidate.reps === best.reps && candidate.effectiveLoad > best.effectiveLoad) return candidate
  return best
}

/**
 * Epley estimate for a set, but only when the set is low-rep enough for the
 * formula to mean anything.
 *
 * @returns The estimate in pounds, or `null` for a bodyweight set or one above
 *   {@link E1RM_MAX_RELIABLE_REPS}.
 */
function reliableOneRepMax(load: number, reps: number): number | null {
  if (reps > E1RM_MAX_RELIABLE_REPS) return null
  return epleyOneRepMax(load, reps)
}

/**
 * Build one movement's day-by-day progression from the whole set log.
 *
 * @param exercise Catalog slug to trend. Matched exactly against
 *   {@link StrengthSet.exercise}; variants are *not* split out, since a wide
 *   pullup and a close one are the same movement getting stronger.
 * @param sets Every logged set, in any order — filtered here, so callers pass
 *   `WeightRoomData.sets` straight through.
 * @param exercises The catalog, for `load_multiplier`. Omitting it treats every
 *   movement as single-implement, which understates a two-dumbbell movement by
 *   half.
 * @param workouts Recorded sessions, so a session's sets stay on the session's
 *   own day. Omitting it dates every set by its own timestamp, which splits a
 *   session that ran past midnight across two points.
 * @param clock Zone every day bucket is measured in; defaults to Pacific (#429).
 * @returns The progression, or `null` when the movement has no plottable sets —
 *   a real state (a catalog row added before its first session), and one the
 *   caller renders as an empty view rather than as a broken chart.
 */
export function buildExerciseProgression(
  exercise: string,
  sets: readonly StrengthSet[],
  exercises: readonly WeightRoomExercise[] = [],
  workouts: readonly WeightRoomWorkout[] = [],
  clock: DayClock = PACIFIC_CLOCK
): ExerciseProgression | null {
  const multipliers = loadMultipliersBySlug(exercises)

  // A session owns its calendar day, and its 12:20am sets belong to the evening
  // that started them — the same rule `workoutDayKey` applies everywhere else.
  // Without it a late gym session lands as two training days with half the work
  // in each.
  const sessionDay = new Map<string, string>()
  for (const workout of workouts) {
    const dayKey = workoutDayKey(workout, clock)
    if (dayKey !== null) sessionDay.set(workout.id, dayKey)
  }

  // Bucket by day key rather than by raw timestamp: this renders on a UTC
  // server, where a 10pm set belongs to the following calendar day and would
  // split one evening's work across two points.
  const byDay = new Map<string, StrengthSet[]>()
  for (const set of sets) {
    if (set.exercise !== exercise) continue
    const dayKey =
      (set.workout_id === undefined ? undefined : sessionDay.get(set.workout_id)) ??
      clock.safeDayKey(set.logged_at)
    // An unparseable timestamp has no day to belong to. Dropped rather than
    // bucketed under the epoch, which would drag the x-axis back to 1970.
    if (dayKey === '') continue
    const list = byDay.get(dayKey)
    if (list) list.push(set)
    else byDay.set(dayKey, [set])
  }

  if (byDay.size === 0) return null

  let totalSets = 0
  let totalReps = 0
  let loadedSets = 0
  let highRepLoadedSets = 0
  let heaviestSet: WorkoutSetHighlight | null = null
  let mostRepsSet: WorkoutSetHighlight | null = null
  let bestOneRepMax: number | null = null

  const points: ExerciseDayPoint[] = []
  // `YYYY-MM-DD` sorts chronologically as a string, which is the whole point of
  // the day-key format — no Date round-trip needed to order the x-axis.
  for (const dayKey of [...byDay.keys()].sort()) {
    const date = clock.toNoon(dayKey)
    if (date === null) continue
    const daySets = byDay.get(dayKey) ?? []

    let reps = 0
    let tonnage = 0
    let dayTop: WorkoutSetHighlight | null = null
    let dayBestReps: WorkoutSetHighlight | null = null
    let dayEstimate: number | null = null

    for (const set of daySets) {
      const effectiveLoad = effectiveSetLoad(set, multipliers)
      const highlight: WorkoutSetHighlight = {
        setId: set.id,
        reps: set.reps,
        weightLbs: set.weight_lbs ?? null,
        effectiveLoad,
        loggedAt: set.logged_at,
        ...(set.duration_seconds === undefined ? {} : { durationSeconds: set.duration_seconds }),
        ...(set.to_failure === true ? { toFailure: true } : {}),
      }

      reps += set.reps
      tonnage += set.reps * effectiveLoad
      if (effectiveLoad > 0) {
        loadedSets += 1
        if (set.reps > E1RM_MAX_RELIABLE_REPS) highRepLoadedSets += 1
      }

      dayTop = heavier(dayTop, highlight)
      dayBestReps = repsier(dayBestReps, highlight)
      heaviestSet = heavier(heaviestSet, highlight)
      mostRepsSet = repsier(mostRepsSet, highlight)

      const estimate = reliableOneRepMax(effectiveLoad, set.reps)
      if (estimate !== null) {
        if (dayEstimate === null || estimate > dayEstimate) dayEstimate = estimate
        if (bestOneRepMax === null || estimate > bestOneRepMax) bestOneRepMax = estimate
      }
    }

    totalSets += daySets.length
    totalReps += reps

    points.push({
      dayKey,
      date,
      sets: daySets.length,
      reps,
      tonnage,
      topSet: dayTop,
      // Safe: `byDay` only holds non-empty arrays, so the loop above assigned at
      // least one highlight.
      bestRepSet: dayBestReps as WorkoutSetHighlight,
      estimatedOneRepMax: dayEstimate,
    })
  }

  // Every bucket held an unparseable key — nothing plottable survived.
  if (points.length === 0 || mostRepsSet === null) return null

  return {
    exercise,
    points,
    isBodyweight: heaviestSet === null,
    totalSets,
    totalReps,
    loadedSets,
    highRepLoadedSets,
    heaviestSet,
    mostRepsSet,
    bestOneRepMax,
  }
}

/**
 * What the log can and can't say about the years before a movement's first
 * recorded set (#412, #413).
 *
 * The Apple Health import brought in hundreds of lifting sessions that record
 * only *that* a workout happened and for how long — never what was done in it.
 * A progression chart that quietly starts at the first set therefore implies the
 * training started there too. It didn't; the writing-it-down did. This is the
 * shape of that gap, so a view can state it in numbers instead of leaving a
 * suspiciously short x-axis to be misread.
 */
export interface SetDetailCoverage {
  /**
   * **Imported** sessions that predate the movement's first set and carry no set
   * detail.
   *
   * Imports only, because the render site names Apple Health as the reason the
   * detail is missing. A manually recorded session that was abandoned before any
   * set was logged is also detail-free, but it isn't an import — counting it
   * would put a number behind a sentence that doesn't describe it.
   */
  sessionsBefore: number
  /** Day key of the earliest such session, or `null` when there are none. */
  earliestSessionDayKey: string | null
}

/**
 * Count the **imported** sessions that predate a movement's first logged set and
 * have no sets of their own.
 *
 * @param firstDayKey The movement's first training day, in `clock's` zone. `null` yields
 *   an empty coverage report rather than counting the whole history as "before".
 * @param workouts Every recorded session. Only `apple_health` ones are counted —
 *   see {@link SetDetailCoverage.sessionsBefore}.
 * @param sets Every logged set — used only to tell which sessions carry detail.
 *   A session with sets isn't part of the gap even if it predates this movement;
 *   it recorded what happened, just not this movement.
 * @param clock Zone each session's day is measured in; defaults to Pacific (#429).
 */
export function buildSetDetailCoverage(
  firstDayKey: string | null,
  workouts: readonly WeightRoomWorkout[],
  sets: readonly StrengthSet[],
  clock: DayClock = PACIFIC_CLOCK
): SetDetailCoverage {
  if (firstDayKey === null) return { sessionsBefore: 0, earliestSessionDayKey: null }

  const workoutsWithSets = new Set<string>()
  for (const set of sets) {
    if (set.workout_id !== undefined) workoutsWithSets.add(set.workout_id)
  }

  let sessionsBefore = 0
  let earliest: string | null = null
  for (const workout of workouts) {
    if (workout.source !== 'apple_health') continue
    if (workoutsWithSets.has(workout.id)) continue
    const dayKey = clock.safeDayKey(workout.started_at)
    // Day keys compare as strings — `2018-01-08` < `2026-05-25` lexicographically
    // and chronologically alike.
    if (dayKey === '' || dayKey >= firstDayKey) continue
    sessionsBefore += 1
    if (earliest === null || dayKey < earliest) earliest = dayKey
  }

  return { sessionsBefore, earliestSessionDayKey: earliest }
}

/**
 * Movements with at least one logged set, most-recently-trained first.
 *
 * Drives the links into the per-exercise view: a movement with no sets has
 * nothing to trend, so it never gets a link that lands on an empty page.
 *
 * @param sets Every logged set.
 * @param clock Zone each day is measured in; defaults to Pacific (#429).
 * @returns Slugs, newest training day first, then alphabetically among movements
 *   last trained the same day.
 */
export function trendableExercises(
  sets: readonly StrengthSet[],
  clock: DayClock = PACIFIC_CLOCK
): string[] {
  const lastDay = new Map<string, string>()
  for (const set of sets) {
    const dayKey = clock.safeDayKey(set.logged_at)
    if (dayKey === '') continue
    const seen = lastDay.get(set.exercise)
    if (seen === undefined || dayKey > seen) lastDay.set(set.exercise, dayKey)
  }
  return [...lastDay.entries()]
    .sort(([aSlug, aDay], [bSlug, bDay]) => bDay.localeCompare(aDay) || aSlug.localeCompare(bSlug))
    .map(([slug]) => slug)
}
