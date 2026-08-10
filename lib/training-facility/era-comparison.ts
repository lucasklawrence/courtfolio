import type { StrengthSet } from '@/types/weight-room'

import { PACIFIC_CLOCK, type DayClock } from './clock'
import type { ExerciseProgression } from './exercise-progression'
import type { WorkoutSetHighlight } from './workout-stats'

/**
 * Then-vs-now for a single movement (#400 phase 2).
 *
 * Importing the iCloud Notes archive gave this log a shape it didn't have
 * before: two stretches of real training with a long silence between them. The
 * 2022-2024 archive ends when the note-taking stopped; the current log begins
 * in 2026. A plain progression chart draws both and lets the eye do the
 * comparing across a two-year gap that compresses to a few pixels.
 *
 * This module does the comparing instead — same movement, two eras, stated in
 * numbers. It is the payoff the import was for: "how I used to lift" is only a
 * question the site can answer once the old sets are in it.
 *
 * The split is **discovered, not configured**. Hardcoding "before 2024-05" would
 * be a fact about this one import that quietly rots the moment another gap
 * appears — a long injury layoff should divide eras exactly the same way. So the
 * boundary is the longest silence in the movement's own history, and a movement
 * trained continuously has no eras and gets no comparison.
 *
 * Pure and isomorphic, like its siblings — it consumes a built
 * {@link ExerciseProgression} and knows nothing about Supabase or React.
 */

/** How long a silence has to be before it separates two eras, in days. */
export const DEFAULT_MIN_GAP_DAYS = 180

/**
 * How recently a movement must have been trained for its later era to count as
 * the present.
 *
 * Deliberately the same figure as {@link DEFAULT_MIN_GAP_DAYS}: if a movement
 * has been quiet for long enough that the silence would itself divide two eras,
 * it is not what the log is currently doing. One threshold, one meaning.
 */
export const DEFAULT_CURRENT_WITHIN_DAYS = DEFAULT_MIN_GAP_DAYS

/** One continuous stretch of training, bounded by a long layoff. */
export interface TrainingEra {
  /** First training day in the era, `YYYY-MM-DD`. */
  startDayKey: string
  /** Last training day in the era, `YYYY-MM-DD`. */
  endDayKey: string
  /** Days on which the movement was trained. Not the calendar span. */
  trainingDays: number
  /** Sets logged in the era. */
  sets: number
  /** Reps logged in the era. */
  reps: number
  /** `Σ reps × effective load` across the era; `0` when it was all bodyweight. */
  tonnage: number
  /** Heaviest single set of the era, or `null` when it was all bodyweight. */
  heaviestSet: WorkoutSetHighlight | null
  /** Best reliable Epley estimate in the era, or `null` when no set qualified. */
  bestOneRepMax: number | null
  /**
   * Median of each training day's top-set load.
   *
   * The honest "what was normal" figure, and deliberately not the mean: one
   * heavy single in an era of light work drags an average up, and a median of
   * daily tops says what the working weight actually was. `null` for a
   * bodyweight era.
   */
  typicalTopSet: number | null
}

/** Two eras of one movement, and what changed between them. */
export interface EraComparison {
  /** The earlier stretch. */
  then: TrainingEra
  /** The later stretch. */
  now: TrainingEra
  /** Calendar days between the last day of {@link then} and the first of {@link now}. */
  gapDays: number
  /**
   * `now − then` on the heaviest set, in pounds of effective load. `null` when
   * either era was bodyweight-only, since there is no difference to state.
   */
  heaviestDelta: number | null
  /** `now − then` on the best reliable 1RM estimate. `null` when either era lacks one. */
  bestOneRepMaxDelta: number | null
  /** `now − then` on the typical (median daily top) working load. */
  typicalTopSetDelta: number | null
  /**
   * Whether current training has passed the archive's heaviest set.
   *
   * `null` rather than `false` when the comparison can't be made — a bodyweight
   * movement hasn't failed to surpass anything, and rendering it as "not yet"
   * would read as a verdict on training that was never being measured that way.
   */
  surpassedHeaviest: boolean | null
}

/**
 * Whole days between two `YYYY-MM-DD` keys.
 *
 * Parsed as UTC midnight on both sides, so the subtraction is unaffected by
 * daylight saving — the keys are already zone-resolved by the clock that
 * produced them, and re-introducing a zone here would make a spring-forward
 * boundary a day short.
 *
 * @param fromDayKey Earlier day key.
 * @param toDayKey Later day key.
 * @returns Days between them; negative when the arguments are reversed, and
 *   `NaN` when either key is unparseable.
 */
export function daysBetween(fromDayKey: string, toDayKey: string): number {
  const from = Date.parse(`${fromDayKey}T00:00:00Z`)
  const to = Date.parse(`${toDayKey}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.NaN
  return Math.round((to - from) / 86_400_000)
}

/**
 * The middle value of a list, averaging the two middles when it is even.
 *
 * @param values Numbers to summarize; not mutated.
 * @returns The median, or `null` for an empty list.
 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Summarize a run of consecutive progression points as one era.
 *
 * @param points A contiguous slice of {@link ExerciseProgression.points}, oldest
 *   first. Must be non-empty — callers only build eras from real slices.
 * @returns The era's totals and bests.
 */
function summarizeEra(points: ExerciseProgression['points']): TrainingEra {
  let sets = 0
  let reps = 0
  let tonnage = 0
  let heaviestSet: WorkoutSetHighlight | null = null
  let bestOneRepMax: number | null = null
  const dailyTops: number[] = []

  for (const point of points) {
    sets += point.sets
    reps += point.reps
    tonnage += point.tonnage

    if (point.topSet !== null) {
      dailyTops.push(point.topSet.effectiveLoad)
      if (heaviestSet === null || point.topSet.effectiveLoad > heaviestSet.effectiveLoad) {
        heaviestSet = point.topSet
      }
    }
    if (
      point.estimatedOneRepMax !== null &&
      (bestOneRepMax === null || point.estimatedOneRepMax > bestOneRepMax)
    ) {
      bestOneRepMax = point.estimatedOneRepMax
    }
  }

  return {
    startDayKey: points[0].dayKey,
    endDayKey: points[points.length - 1].dayKey,
    trainingDays: points.length,
    sets,
    reps,
    tonnage,
    heaviestSet,
    bestOneRepMax,
    typicalTopSet: median(dailyTops),
  }
}

/**
 * Subtract two possibly-absent measures.
 *
 * @returns `now − then`, or `null` when either side is missing — an era with no
 *   loaded work has no number to compare, and coercing the gap to zero would
 *   render "no change" over training that was never loaded.
 */
function delta(then: number | null, now: number | null): number | null {
  if (then === null || now === null) return null
  return now - then
}

/**
 * Split a movement's history at its longest layoff and compare the two sides.
 *
 * @param progression The movement's full progression, as built by
 *   `buildExerciseProgression`. Points must be oldest-first, which that
 *   function guarantees.
 * @param minGapDays How long a silence must be to count as an era boundary;
 *   defaults to {@link DEFAULT_MIN_GAP_DAYS}. Shorter than this and the movement
 *   reads as continuously trained.
 * @returns The comparison, or `null` when the movement has fewer than two
 *   training days or no silence long enough to split on. Null is the common
 *   case for a movement only ever trained in the current era, and the render
 *   site simply omits the panel.
 */
export function buildEraComparison(
  progression: ExerciseProgression,
  minGapDays: number = DEFAULT_MIN_GAP_DAYS
): EraComparison | null {
  const { points } = progression
  if (points.length < 2) return null

  // The longest silence, not merely the first one over the threshold: a
  // movement with two layoffs should divide at the real break in the history,
  // and taking the first would make the answer depend on scan order.
  let splitAt = -1
  let longest = 0
  for (let i = 1; i < points.length; i += 1) {
    const gap = daysBetween(points[i - 1].dayKey, points[i].dayKey)
    if (Number.isFinite(gap) && gap > longest) {
      longest = gap
      splitAt = i
    }
  }

  if (splitAt < 1 || longest < minGapDays) return null

  const then = summarizeEra(points.slice(0, splitAt))
  const now = summarizeEra(points.slice(splitAt))

  const heaviestDelta = delta(
    then.heaviestSet?.effectiveLoad ?? null,
    now.heaviestSet?.effectiveLoad ?? null
  )

  return {
    then,
    now,
    gapDays: longest,
    heaviestDelta,
    bestOneRepMaxDelta: delta(then.bestOneRepMax, now.bestOneRepMax),
    typicalTopSetDelta: delta(then.typicalTopSet, now.typicalTopSet),
    surpassedHeaviest: heaviestDelta === null ? null : heaviestDelta > 0,
  }
}

/**
 * Whether a movement's later era is what the log is currently doing (#441).
 *
 * "Then" and "Now" are a claim about the present, and for most movements in
 * this log it is false: barbell work, machine work and sled pushes stopped in
 * 2024, so their later era is two years old. Splitting the archive against
 * itself is still worth showing — 2023 dips against 2024 dips is a real
 * comparison — but calling the 2024 half "Now" is not.
 *
 * Measured against **the log's own most recent training day**, not the wall
 * clock. That keeps the answer stable when the page is rendered, makes it
 * testable without freezing time, and means the whole thing self-corrects: pick
 * a movement back up and its later era becomes current again, stop training for
 * six months and every movement goes quiet together rather than one page
 * disagreeing with the rest.
 *
 * @param era The later era, from {@link buildEraComparison}.
 * @param latestLoggedDayKey The most recent training day anywhere in the log,
 *   `YYYY-MM-DD`. An empty string yields `false` — with nothing to compare
 *   against, claiming currency would be a guess.
 * @param withinDays How recent counts; defaults to
 *   {@link DEFAULT_CURRENT_WITHIN_DAYS}.
 * @returns True when the era reaches close enough to the end of the log.
 */
export function isCurrentEra(
  era: TrainingEra,
  latestLoggedDayKey: string,
  withinDays: number = DEFAULT_CURRENT_WITHIN_DAYS
): boolean {
  if (latestLoggedDayKey === '') return false
  const behind = daysBetween(era.endDayKey, latestLoggedDayKey)
  if (!Number.isFinite(behind)) return false
  return behind <= withinDays
}

/**
 * The most recent training day anywhere in the log.
 *
 * The reference point {@link isCurrentEra} measures against — "recent" has to
 * mean recent *relative to the training*, not to whenever someone loads the
 * page, or a site left alone for a year would declare its own history stale.
 *
 * @param sets Every logged set.
 * @param clock Zone each day is measured in; defaults to Pacific (#429).
 * @returns `YYYY-MM-DD`, or `''` when nothing is logged.
 */
export function latestLoggedDay(
  sets: readonly StrengthSet[],
  clock: DayClock = PACIFIC_CLOCK
): string {
  let latest = ''
  for (const set of sets) {
    const dayKey = clock.safeDayKey(set.logged_at)
    if (dayKey !== '' && dayKey > latest) latest = dayKey
  }
  return latest
}

/**
 * Whether an era's training was transcribed from the Apple Notes archive (#400).
 *
 * Asked rather than assumed. A long gap is not evidence of an import — a
 * movement can simply have been left alone for a year — so a panel that claimed
 * "the earlier one comes from Apple Notes" on every qualifying gap would state a
 * provenance it never checked.
 *
 * @param era The era to test, from {@link buildEraComparison}.
 * @param exercise Catalog slug the era belongs to; sets of other movements in
 *   the same window are irrelevant and must not vote.
 * @param sets Every logged set — filtered here, so callers pass the same array
 *   they gave `buildExerciseProgression`.
 * @param clock Zone each set's day is measured in; defaults to Pacific (#429).
 * @returns True when at least one imported set of this movement falls inside
 *   the era's span.
 */
export function eraIsImported(
  era: TrainingEra,
  exercise: string,
  sets: readonly StrengthSet[],
  clock: DayClock = PACIFIC_CLOCK
): boolean {
  return sets.some(set => {
    if (set.exercise !== exercise) return false
    if (set.source !== 'icloud_notes') return false
    const dayKey = clock.safeDayKey(set.logged_at)
    // Day keys compare as strings — `2024-01-10` <= `2024-04-16` lexicographically
    // and chronologically alike.
    return dayKey !== '' && dayKey >= era.startDayKey && dayKey <= era.endDayKey
  })
}
