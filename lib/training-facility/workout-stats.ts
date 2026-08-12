import type {
  StrengthSet,
  WeightRoomExercise,
  WeightRoomWorkout,
  WorkoutTemplate,
} from '@/types/weight-room'

import { buildSlotProgress, extraSets, type SlotProgress } from './live-workout'
import { countedReps } from './set-reps'
import { PACIFIC_CLOCK, type DayClock } from './clock'
import { compareInstants, isStaleOpenWorkout, workoutDurationMinutes } from './workout-sessions'

/**
 * Per-workout statistics (#377) — the payoff of the #372 arc.
 *
 * Every other Weight Room aggregation takes the **calendar day** as its unit:
 * `weight-room-history.ts` counts streaks and weekly volume, `strength-today.ts`
 * sums a day against a ring, `load-management.ts` ramps a movement over trailing
 * windows. All correct for grease-the-groove, and all the wrong altitude for
 * "how did tonight's push day go, and was it better than last time".
 *
 * This module answers at the **session** altitude. It is pure and isomorphic —
 * no Supabase client, no React, and no clock except where a caller passes one —
 * so the arithmetic that's easy to get quietly wrong (what counts as tonnage,
 * what counts as adherence when a movement was substituted) is unit-testable
 * rather than only observable by standing in a gym.
 */

/**
 * Reps above which an Epley estimate stops being worth showing as a number.
 *
 * Epley is a linear fit calibrated on low-rep sets; past roughly a dozen reps it
 * drifts high enough that a "estimated 315 lb max" off a set of 20 is noise
 * dressed as a measurement. Estimates are still computed above this — they're
 * just marked {@link ExerciseBreakdown.oneRepMaxIsReliable} `false` so the UI can
 * de-emphasize rather than silently mislead.
 *
 * This matters more for the per-exercise e1RM trend (#412) than it does here: a
 * single unreliable estimate in one session's breakdown is easy to discount, but
 * plotted as a point on a progression line it reads as a measurement like any
 * other. Whatever draws that chart should treat this as the cutoff for a solid
 * point rather than re-deriving its own.
 */
export const E1RM_MAX_RELIABLE_REPS = 12

/**
 * Estimated one-rep max from a single set, via Epley: `w × (1 + r/30)`.
 *
 * A single rep returns the load itself rather than Epley's `w × 1.033`. Lifting
 * a weight once *is* a one-rep max of that weight; inflating a true single by
 * 3% would make the estimate beat the measurement, which is indefensible.
 *
 * @param effectiveLoad Total pounds actually moved on the set — per-implement
 *   `weight_lbs` already multiplied by the movement's `load_multiplier`.
 * @param reps Reps completed at that load.
 * @returns The estimate in pounds, or `null` for a bodyweight or nonsensical set
 *   (non-positive load or reps), which has no meaningful one-rep max.
 */
export function epleyOneRepMax(effectiveLoad: number, reps: number): number | null {
  if (!Number.isFinite(effectiveLoad) || !Number.isFinite(reps)) return null
  if (effectiveLoad <= 0 || reps <= 0) return null
  if (reps === 1) return effectiveLoad
  return effectiveLoad * (1 + reps / 30)
}

/**
 * Build a `slug → load_multiplier` lookup from the catalog, clamped to at least
 * `1`.
 *
 * Catalog-sourced rather than goal-sourced (#373): the multiplier moved to
 * `weight_room_exercises` precisely so movements with no daily goal — which is
 * every gym lift — still carry it. Reading it off goals here would silently
 * halve tonnage for two-dumbbell gym work.
 *
 * @param exercises The movement roster; may be empty or omit a movement, in
 *   which case that movement falls back to a single implement. Understating a
 *   pair is recoverable; inventing load that was never lifted is not.
 */
export function loadMultipliersBySlug(
  exercises: readonly WeightRoomExercise[] = []
): Map<string, number> {
  return new Map(exercises.map(e => [e.slug, Math.max(1, e.load_multiplier ?? 1)]))
}

/**
 * Pounds actually moved on one set — per-implement `weight_lbs` times the
 * movement's implement count.
 *
 * @returns `0` for a bodyweight set. Deliberately `0` rather than `null`: it
 *   sums into tonnage without a branch at every call site, and a bodyweight set
 *   genuinely contributes no *external* load.
 */
export function effectiveSetLoad(
  set: Pick<StrengthSet, 'exercise' | 'weight_lbs'>,
  multipliers: ReadonlyMap<string, number>
): number {
  const perImplement = set.weight_lbs
  if (typeof perImplement !== 'number' || !Number.isFinite(perImplement) || perImplement <= 0) {
    return 0
  }
  return perImplement * (multipliers.get(set.exercise) ?? 1)
}

/**
 * How many working sets a list of rows describes (#440).
 *
 * Most rows are a set each. The exception is a row carrying a `set_group`: the
 * drops of one pass down a rack are several rows describing a single set, so
 * they collapse to one. Grouping is keyed on `(exercise, set_group)` because a
 * group number is only unique within the movement that recorded it.
 *
 * @param sets Rows from one session.
 * @returns Sets actually performed, which is at most `sets.length`.
 */
export function countWorkingSets(sets: readonly StrengthSet[]): number {
  let ungrouped = 0
  const groups = new Set<string>()
  for (const set of sets) {
    if (set.set_group === undefined) ungrouped += 1
    else groups.add(`${set.exercise}|${set.set_group}`)
  }
  return ungrouped + groups.size
}

/** One notable set, as surfaced in a breakdown row. */
export interface WorkoutSetHighlight {
  /** {@link StrengthSet.id} of the set. */
  setId: string
  /**
   * Reps completed, or `null` when the count was never recorded (#440) — a
   * rack-run drop taken to failure, where the note captured only the load.
   */
  reps: number | null
  /** Load on one implement, or `null` for a bodyweight set. */
  weightLbs: number | null
  /** Pounds actually moved — `weightLbs × load_multiplier`; `0` for bodyweight. */
  effectiveLoad: number
  /** ISO timestamp the set was logged. */
  loggedAt: string
  /**
   * Seconds the set was held, for an isometric movement (#400).
   *
   * Absent for everything counted in repetitions. When present, `reps` is 1 and
   * this is what the set actually was — render sites should prefer
   * `describeSetOrHold`, which says `45s` where `describeSet` would say `1 rep`.
   */
  durationSeconds?: number
  /**
   * Whether the set went to failure with its rep count unrecorded (#435).
   *
   * When true, `reps` is 1 and means "one set", not one repetition — render
   * sites should prefer `describeSetOrHold`, which says "to failure".
   */
  toFailure?: boolean
}

/** One movement's contribution to a session. */
export interface ExerciseBreakdown {
  /** Catalog slug, verbatim from the set rows. */
  exercise: string
  /** Catalog `display_name`, or absent when the movement has no catalog row. */
  displayName?: string
  /** Sets of this movement in the session. */
  sets: number
  /** Total reps across those sets. */
  reps: number
  /** `Σ reps × effective load` for this movement. `0` when every set was bodyweight. */
  tonnage: number
  /**
   * Heaviest set by effective load, ties broken toward more reps. `null` when
   * the movement was performed entirely bodyweight — which is the common case
   * here, not an edge case.
   */
  topSet: WorkoutSetHighlight | null
  /**
   * Most reps in a single set. Never `null` — every set has reps, so this is the
   * headline for bodyweight movements the way {@link topSet} is for loaded ones.
   */
  bestRepSet: WorkoutSetHighlight
  /** Epley estimate off {@link topSet}, or `null` when the movement was bodyweight. */
  estimatedOneRepMax: number | null
  /**
   * Whether {@link estimatedOneRepMax} came from a set at or below
   * {@link E1RM_MAX_RELIABLE_REPS}. `false` means "shown, but treat it as a
   * gesture" — see the constant. Always `false` when there's no estimate.
   */
  oneRepMaxIsReliable: boolean
  /** Whether every set of this movement carried no external load. */
  isBodyweight: boolean
}

/** Rate at which work was done, once a session has a duration. */
export interface WorkoutDensity {
  /** Pounds moved per minute. `0` for an all-bodyweight session. */
  tonnagePerMinute: number
  /** Sets per minute. */
  setsPerMinute: number
  /** Reps per minute. */
  repsPerMinute: number
}

/** Everything computable about one session from its own sets. */
export interface WorkoutSummary {
  /** The session being summarized. */
  workout: WeightRoomWorkout
  /** Sets belonging to it, oldest first. */
  sets: StrengthSet[]
  /**
   * Elapsed minutes, or `null` while in progress or abandoned — see
   * {@link isInProgress} / {@link isAbandoned} for which.
   */
  durationMinutes: number | null
  /** Whether the session has no `ended_at` yet. */
  isInProgress: boolean
  /**
   * Whether the session was left open long enough to be considered abandoned
   * rather than still running. An abandoned session has no honest duration, so
   * the UI shows sets and reps and says the duration is unknown rather than
   * printing hours that weren't spent training.
   */
  isAbandoned: boolean
  /** Total sets logged. */
  totalSets: number
  /** Total reps across every set. */
  totalReps: number
  /** `Σ reps × effective load` across the session. */
  tonnage: number
  /** How many sets carried external load. */
  weightedSets: number
  /**
   * How many sets carried none. Surfaced so the UI can *state* that bodyweight
   * work is excluded from tonnage rather than leaving a smaller-than-expected
   * number unexplained.
   */
  bodyweightSets: number
  /** Work rate, or `null` without a duration to divide by. */
  density: WorkoutDensity | null
  /** Per-movement breakdown, heaviest tonnage first, then most reps. */
  exercises: ExerciseBreakdown[]
}

/**
 * Summarize one session from its own sets.
 *
 * @param workout The session.
 * @param sets Sets belonging to it. Callers filter by `workout_id`; anything
 *   passed here is counted, so a loose set slipped in would be double-counted
 *   against the day it also belongs to.
 * @param exercises The movement catalog, for `load_multiplier` and display
 *   labels. Omitting it treats every movement as single-implement.
 * @param now Evaluation instant for the abandoned check; defaults to system
 *   time. Tests pin it.
 */
export function buildWorkoutSummary(
  workout: WeightRoomWorkout,
  sets: readonly StrengthSet[],
  exercises: readonly WeightRoomExercise[] = [],
  now: Date = new Date()
): WorkoutSummary {
  const multipliers = loadMultipliersBySlug(exercises)
  const labels = new Map(exercises.map(e => [e.slug, e.display_name]))

  // Instants, not strings — see `compareInstants`. Sorting these lexicographically
  // scrambles a session whose sets carry mixed `Z` and Pacific offsets, and
  // `WorkoutSummary.sets` promises oldest-first.
  const ordered = [...sets].sort((a, b) => compareInstants(a.logged_at, b.logged_at))

  const isInProgress = workout.ended_at === undefined
  const isAbandoned = isInProgress && isStaleOpenWorkout(workout.started_at, now)
  const durationMinutes = workoutDurationMinutes(workout)

  let totalReps = 0
  let tonnage = 0
  let weightedSets = 0

  // Rows, collapsed into the sets they describe — a two-pass rack run is five
  // rows and two sets (#440).
  const workingSets = countWorkingSets(ordered)

  const byExercise = new Map<string, StrengthSet[]>()
  for (const set of ordered) {
    const load = effectiveSetLoad(set, multipliers)
    // An unrecorded count adds nothing rather than inventing one (#440).
    totalReps += countedReps(set)
    tonnage += countedReps(set) * load
    if (load > 0) weightedSets += 1
    const list = byExercise.get(set.exercise)
    if (list) list.push(set)
    else byExercise.set(set.exercise, [set])
  }

  const breakdown: ExerciseBreakdown[] = []
  for (const [exercise, exSets] of byExercise) {
    let reps = 0
    let exTonnage = 0
    let top: WorkoutSetHighlight | null = null
    let bestReps: WorkoutSetHighlight | null = null

    for (const set of exSets) {
      const effectiveLoad = effectiveSetLoad(set, multipliers)
      reps += countedReps(set)
      exTonnage += countedReps(set) * effectiveLoad
      const highlight: WorkoutSetHighlight = {
        setId: set.id,
        reps: set.reps,
        weightLbs: set.weight_lbs ?? null,
        effectiveLoad,
        loggedAt: set.logged_at,
        ...(set.duration_seconds === undefined ? {} : { durationSeconds: set.duration_seconds }),
        ...(set.to_failure === true ? { toFailure: true } : {}),
      }
      // Heaviest wins; at equal load the one with more reps is the better set.
      // An unrecorded count can't win a reps tiebreak or a most-reps contest —
      // `countedReps` makes it lose rather than throw (#440).
      if (
        effectiveLoad > 0 &&
        (top === null ||
          effectiveLoad > top.effectiveLoad ||
          (effectiveLoad === top.effectiveLoad && countedReps(set) > countedReps(top.reps)))
      ) {
        top = highlight
      }
      if (bestReps === null || countedReps(set) > countedReps(bestReps.reps)) bestReps = highlight
    }

    // No recorded count, no Epley estimate — the formula needs reps (#440).
    const estimate =
      top === null || top.reps === null ? null : epleyOneRepMax(top.effectiveLoad, top.reps)
    breakdown.push({
      exercise,
      ...(labels.has(exercise) ? { displayName: labels.get(exercise) } : {}),
      sets: countWorkingSets(exSets),
      reps,
      tonnage: exTonnage,
      topSet: top,
      // Safe: `byExercise` only ever holds non-empty arrays, so the loop above
      // always assigned at least one highlight.
      bestRepSet: bestReps as WorkoutSetHighlight,
      estimatedOneRepMax: estimate,
      oneRepMaxIsReliable:
        estimate !== null && top !== null && countedReps(top.reps) <= E1RM_MAX_RELIABLE_REPS,
      isBodyweight: top === null,
    })
  }

  breakdown.sort(
    (a, b) => b.tonnage - a.tonnage || b.reps - a.reps || a.exercise.localeCompare(b.exercise)
  )

  const density =
    durationMinutes !== null && durationMinutes > 0
      ? {
          tonnagePerMinute: tonnage / durationMinutes,
          setsPerMinute: workingSets / durationMinutes,
          repsPerMinute: totalReps / durationMinutes,
        }
      : null

  return {
    workout,
    sets: ordered,
    durationMinutes,
    isInProgress,
    isAbandoned,
    totalSets: workingSets,
    totalReps,
    tonnage,
    weightedSets,
    bodyweightSets: Math.max(0, workingSets - weightedSets),
    density,
    exercises: breakdown,
  }
}

/** How one prescribed slot actually went. */
export interface SlotAdherence extends SlotProgress {
  /**
   * Sets still owed against {@link TemplateSlot.target_sets}; `0` once the
   * prescription is met. A set range is satisfied at its floor, so `4` of "4–5"
   * owes nothing.
   */
  shortfall: number
  /** Sets logged beyond the prescription's ceiling; `0` when inside it. */
  surplus: number
}

/** Prescribed-vs-actual for a whole session. */
export interface WorkoutAdherence {
  /** One entry per template slot, in prescription order. Empty for a freestyle session. */
  slots: SlotAdherence[]
  /** Sets logged against no slot — the accessory work added on the day. */
  extra: StrengthSet[]
  /** How many sets the template prescribed in total. */
  prescribedSets: number
  /** How many of those were performed, capped per slot so surplus can't mask a shortfall elsewhere. */
  completedSets: number
  /** Slots that met their prescription. */
  completedSlots: number
  /**
   * Slots performed with a movement other than the one prescribed. Counted
   * separately because a substitution is a **normal outcome**, not a miss — the
   * rack was taken — and it counts toward completion.
   */
  substitutedSlots: number
  /**
   * Share of prescribed sets performed, `0`–`1`. `1` for a freestyle session:
   * nothing was prescribed, so nothing was missed.
   *
   * Prescribed sets is the honest denominator — a session that swapped every
   * movement but did every set is 100%, and one that did 3 of 5 on one slot is
   * not rescued by an extra set somewhere else.
   */
  completion: number
}

/**
 * Line a session's sets up against the template it was running.
 *
 * Built on {@link buildSlotProgress} (#376) so the live panel and the summary
 * can never disagree about what counts as a substitution: a set carrying a slot
 * whose exercise differs from the slot's own *is* the substitution record.
 *
 * @param template The template the session ran, or `null` for a freestyle
 *   session — which yields no slots, so every set is extra work.
 * @param workoutSets Sets belonging to the session.
 */
export function buildWorkoutAdherence(
  template: WorkoutTemplate | null,
  workoutSets: readonly StrengthSet[]
): WorkoutAdherence {
  const progress = buildSlotProgress(template, workoutSets)

  let prescribedSets = 0
  let completedSets = 0
  let completedSlots = 0
  let substitutedSlots = 0

  const slots: SlotAdherence[] = progress.map(entry => {
    const floor = entry.slot.target_sets
    const ceiling = entry.slot.target_sets_max ?? floor
    prescribedSets += floor
    // `completedSets`, not `logged`: for a stepped slot those differ (#407) —
    // two passes down a rack run are eight rows but two prescribed sets, and
    // crediting rows would score a half-finished drop set as over-delivery.
    // Capped at the floor besides: doing 8 sets of one movement doesn't pay
    // down the two you skipped on another.
    completedSets += Math.min(entry.completedSets, floor)
    if (entry.isComplete) completedSlots += 1
    if (entry.isSubstituted) substitutedSlots += 1
    return {
      ...entry,
      shortfall: Math.max(0, floor - entry.completedSets),
      surplus: Math.max(0, entry.completedSets - ceiling),
    }
  })

  return {
    slots,
    extra: extraSets(workoutSets),
    prescribedSets,
    completedSets,
    completedSlots,
    substitutedSlots,
    completion: prescribedSets === 0 ? 1 : Math.min(1, completedSets / prescribedSets),
  }
}

/** Change in one movement between two runs of the same template. */
export interface ExerciseDelta {
  /** Catalog slug. */
  exercise: string
  /** Catalog `display_name`, when known. */
  displayName?: string
  /** This session's tonnage minus the previous session's. */
  tonnageDelta: number
  /** This session's reps minus the previous session's. */
  repsDelta: number
  /**
   * Change in heaviest effective load, or `null` when either session performed
   * the movement bodyweight — there's no load delta between "none" and "none",
   * and reporting `0` would read as "no progress" rather than "not applicable".
   */
  topSetLoadDelta: number | null
  /** Whether the movement appears in this session but not the previous one. */
  isNew: boolean
}

/** This session measured against the last run of the same template. */
export interface WorkoutComparison {
  /** The session compared against. */
  previous: WorkoutSummary
  /** Tonnage change. */
  tonnageDelta: number
  /** Rep change. */
  repsDelta: number
  /** Set-count change. */
  setsDelta: number
  /** Duration change in minutes, or `null` when either session lacks a duration. */
  durationDelta: number | null
  /** Per-movement changes, biggest tonnage gain first. Movements dropped since last time are omitted. */
  exercises: ExerciseDelta[]
}

/**
 * The most recent completed run of the same template before this one.
 *
 * Matched on {@link WeightRoomWorkout.template_id}, never on `title` — names
 * aren't unique and the title is free text, so matching on it compares against
 * the wrong session (#376). A freestyle session has no template and therefore no
 * previous run.
 *
 * @param workout The session to find a predecessor for.
 * @param candidates Other sessions; order doesn't matter.
 * @returns The nearest earlier session running the same template, or `null`.
 */
export function findPreviousRun(
  workout: WeightRoomWorkout,
  candidates: readonly WeightRoomWorkout[]
): WeightRoomWorkout | null {
  if (workout.template_id === undefined) return null
  const startedAt = new Date(workout.started_at).getTime()
  if (!Number.isFinite(startedAt)) return null

  let best: WeightRoomWorkout | null = null
  let bestStart = -Infinity
  for (const candidate of candidates) {
    if (candidate.id === workout.id) continue
    if (candidate.template_id !== workout.template_id) continue
    const candidateStart = new Date(candidate.started_at).getTime()
    // Compared as instants, not strings: this codebase mixes `Z` and Pacific
    // offsets, so ISO strings don't sort chronologically (see `endsBeforeStart`).
    if (!Number.isFinite(candidateStart) || candidateStart >= startedAt) continue
    if (candidateStart > bestStart) {
      best = candidate
      bestStart = candidateStart
    }
  }
  return best
}

/**
 * Compare a session to the previous run of the same template.
 *
 * @param current This session's summary.
 * @param previous The previous run's summary, or `null` when there isn't one —
 *   a template's first outing, which the UI renders as "no previous run to
 *   compare against" rather than as zero deltas.
 */
export function compareToPrevious(
  current: WorkoutSummary,
  previous: WorkoutSummary | null
): WorkoutComparison | null {
  if (previous === null) return null

  const previousByExercise = new Map(previous.exercises.map(e => [e.exercise, e]))
  const exercises: ExerciseDelta[] = current.exercises.map(entry => {
    const before = previousByExercise.get(entry.exercise)
    const currentLoad = entry.topSet?.effectiveLoad ?? null
    const previousLoad = before?.topSet?.effectiveLoad ?? null
    return {
      exercise: entry.exercise,
      ...(entry.displayName !== undefined ? { displayName: entry.displayName } : {}),
      tonnageDelta: entry.tonnage - (before?.tonnage ?? 0),
      repsDelta: entry.reps - (before?.reps ?? 0),
      topSetLoadDelta:
        currentLoad === null || previousLoad === null ? null : currentLoad - previousLoad,
      isNew: before === undefined,
    }
  })
  exercises.sort((a, b) => b.tonnageDelta - a.tonnageDelta || a.exercise.localeCompare(b.exercise))

  return {
    previous,
    tonnageDelta: current.tonnage - previous.tonnage,
    repsDelta: current.totalReps - previous.totalReps,
    setsDelta: current.totalSets - previous.totalSets,
    durationDelta:
      current.durationMinutes === null || previous.durationMinutes === null
        ? null
        : current.durationMinutes - previous.durationMinutes,
    exercises,
  }
}

/** Which record a set broke. */
export type PersonalBestKind = 'load' | 'reps'

/**
 * A record set during a session — best for that movement **as of that session**.
 *
 * Not a claim that the mark still stands: the baseline is everything logged
 * before the session began (see {@link findPersonalBests}), so a later session
 * may since have beaten it. That's the honest unit for a per-session summary —
 * "this workout was a breakthrough" stays true forever, whereas "this is your
 * all-time best" silently becomes false the next time you out-lift it. Render
 * sites must phrase it accordingly.
 */
export interface WorkoutPersonalBest {
  /** Catalog slug of the movement. */
  exercise: string
  /** Catalog `display_name`, when known. */
  displayName?: string
  /**
   * `'load'` — heaviest effective load ever for the movement. `'reps'` — most
   * reps in one set, reported only for movements performed bodyweight, where
   * load can't be the record.
   */
  kind: PersonalBestKind
  /** The record-setting set. */
  set: WorkoutSetHighlight
  /**
   * The mark it beat, or `null` when this is the movement's first-ever set —
   * which is a first, not a personal *best*, and the UI should say so.
   */
  previousBest: number | null
}

/**
 * Records set during a session — bests as of that session, not marks that are
 * guaranteed to still stand. See {@link WorkoutPersonalBest}.
 *
 * "All-time" is measured against every set of that movement logged **strictly
 * before this session started** — including loose grease-the-groove sets, which
 * are real reps against the same movement and would make a "best ever" claim
 * false if ignored. Sets from within the session itself are the candidates, not
 * the baseline.
 *
 * A movement is judged on load when this session loaded it, and on reps only
 * when it was performed entirely bodyweight. Reporting a rep PR alongside a load
 * PR for the same loaded movement would flag a light high-rep back-off set as an
 * achievement.
 *
 * @param summary The session's summary.
 * @param priorSets Every set logged before this session — the baseline. Sets at
 *   or after the session's start are ignored, so the caller may pass the whole
 *   log without pre-filtering.
 * @param exercises The catalog, for `load_multiplier` on the baseline sets and
 *   for display labels.
 */
export function findPersonalBests(
  summary: WorkoutSummary,
  priorSets: readonly StrengthSet[],
  exercises: readonly WeightRoomExercise[] = []
): WorkoutPersonalBest[] {
  const multipliers = loadMultipliersBySlug(exercises)
  const labels = new Map(exercises.map(e => [e.slug, e.display_name]))
  const startedAt = new Date(summary.workout.started_at).getTime()
  const sessionSetIds = new Set(summary.sets.map(s => s.id))

  // Best load and best reps per movement across everything that predates the
  // session. Sets from the session itself are excluded by id as well as by
  // timestamp: a caller passing the full log would otherwise have the session's
  // own sets set the record they're being tested against.
  const bestLoad = new Map<string, number>()
  const bestReps = new Map<string, number>()
  for (const set of priorSets) {
    if (sessionSetIds.has(set.id)) continue
    const loggedAt = new Date(set.logged_at).getTime()
    if (!Number.isFinite(loggedAt) || !Number.isFinite(startedAt) || loggedAt >= startedAt) continue
    const load = effectiveSetLoad(set, multipliers)
    if (load > (bestLoad.get(set.exercise) ?? 0)) bestLoad.set(set.exercise, load)
    // A set with no recorded count can't hold a reps record.
    const reps = countedReps(set)
    if (reps > (bestReps.get(set.exercise) ?? 0)) bestReps.set(set.exercise, reps)
  }

  const bests: WorkoutPersonalBest[] = []
  for (const entry of summary.exercises) {
    const label = labels.get(entry.exercise)
    const withLabel = label === undefined ? {} : { displayName: label }

    if (!entry.isBodyweight && entry.topSet !== null) {
      const previous = bestLoad.get(entry.exercise) ?? 0
      if (entry.topSet.effectiveLoad > previous) {
        bests.push({
          exercise: entry.exercise,
          ...withLabel,
          kind: 'load',
          set: entry.topSet,
          previousBest: previous > 0 ? previous : null,
        })
      }
      continue
    }

    const previousReps = bestReps.get(entry.exercise) ?? 0
    // A set with no recorded count cannot take a most-reps record.
    if (countedReps(entry.bestRepSet.reps) > previousReps) {
      bests.push({
        exercise: entry.exercise,
        ...withLabel,
        kind: 'reps',
        set: entry.bestRepSet,
        previousBest: previousReps > 0 ? previousReps : null,
      })
    }
  }

  return bests
}

/**
 * What to call a session in a heading (#413).
 *
 * Shared by the history row and the summary page so the two can never disagree
 * about the same workout — they did, briefly, and the disagreement was exactly
 * the sort that matters: the list called an imported session "Strength
 * training" while its own detail page called it "Freestyle session".
 *
 * "Freestyle session" asserts an *intent* — that a plan was available and
 * declined. That's true of a workout someone started without picking a
 * template, and false of one imported from Apple Health, which had no template
 * to decline because the app wasn't involved.
 *
 * @param workout The session being titled.
 * @param templateName Name of the template it ran, or `null`.
 */
export function workoutDisplayTitle(
  workout: Pick<WeightRoomWorkout, 'source' | 'title'>,
  templateName: string | null
): string {
  if (templateName !== null) return templateName
  if (workout.title !== undefined) return workout.title
  return workout.source === 'apple_health' ? 'Strength training' : 'Freestyle session'
}

/** One row of the workout history list. */
export interface WorkoutHistoryEntry {
  /** The session. */
  workout: WeightRoomWorkout
  /** Its summary — the list shows duration, sets, reps, and tonnage per row. */
  summary: WorkoutSummary
  /** Name of the template it ran, or `null` for a freestyle session or a deleted template. */
  templateName: string | null
  /** Hex chip color from the template, when it has one. */
  templateColor: string | null
}

/**
 * Build the reverse-chronological workout history.
 *
 * @param workouts Every session.
 * @param sets Every logged set; grouped by `workout_id` here so callers make one
 *   read rather than one per session. Loose sets are ignored.
 * @param templates Templates, for names and chip colors.
 * @param exercises The catalog, for multipliers and labels.
 * @param now Evaluation instant for the abandoned check; defaults to system time.
 */
export function buildWorkoutHistory(
  workouts: readonly WeightRoomWorkout[],
  sets: readonly StrengthSet[],
  templates: readonly WorkoutTemplate[] = [],
  exercises: readonly WeightRoomExercise[] = [],
  now: Date = new Date()
): WorkoutHistoryEntry[] {
  const templateById = new Map(templates.map(t => [t.id, t]))
  const setsByWorkout = new Map<string, StrengthSet[]>()
  for (const set of sets) {
    if (set.workout_id === undefined) continue
    const list = setsByWorkout.get(set.workout_id)
    if (list) list.push(set)
    else setsByWorkout.set(set.workout_id, [set])
  }

  return [...workouts]
    .sort((a, b) => {
      // Newest first, compared as instants for the mixed-offset reason
      // `compareInstants` documents. Not expressed as a reversal of that
      // helper: reversing it — by swapping the arguments or negating the
      // result — also reverses its unparseable-sorts-last rule, which would put
      // a broken timestamp at the top of the history.
      const at = new Date(a.started_at).getTime()
      const bt = new Date(b.started_at).getTime()
      const aValid = Number.isFinite(at)
      const bValid = Number.isFinite(bt)
      if (!aValid || !bValid) return aValid ? -1 : bValid ? 1 : 0
      return bt - at
    })
    .map(workout => {
      const template =
        workout.template_id === undefined ? undefined : templateById.get(workout.template_id)
      return {
        workout,
        summary: buildWorkoutSummary(workout, setsByWorkout.get(workout.id) ?? [], exercises, now),
        // The name as it read when the session ran (#377), so renaming a
        // template doesn't retitle history — and so a session whose template was
        // since deleted still says what it was. Falls back to the live template
        // for sessions recorded before snapshots existed.
        templateName: workout.prescription?.name ?? template?.name ?? null,
        // Color is presentation, not record: it lives only on the live template,
        // and recoloring a template legitimately recolors its whole history.
        templateColor: template?.color ?? null,
      }
    })
}

/** How many history rows one page of the workout list carries (#416). */
export const WORKOUT_PAGE_SIZE = 50

/** One year's worth of recorded sessions, for the history's year rail (#416). */
export interface WorkoutYearOption {
  /** Calendar year, Pacific. */
  year: number
  /** Sessions started in it. */
  count: number
}

/**
 * Group history entries by their Pacific calendar year, newest year first.
 *
 * Years with no sessions are simply absent rather than filled in with zeroes —
 * the gaps are the interesting part. A log running 2018, 2021–2024, 2026 says
 * something true about the training behind it, and inventing empty 2019 and
 * 2020 chips would bury that under uniformity.
 *
 * @param entries History entries, in any order.
 * @param clock Zone the year boundary is measured in; defaults to Pacific (#429).
 */
export function workoutYearOptions(
  entries: readonly WorkoutHistoryEntry[],
  clock: DayClock = PACIFIC_CLOCK
): WorkoutYearOption[] {
  const counts = new Map<number, number>()
  for (const entry of entries) {
    const dayKey = clock.safeDayKey(entry.workout.started_at)
    if (dayKey === '') continue
    const year = Number(dayKey.slice(0, 4))
    if (!Number.isFinite(year)) continue
    counts.set(year, (counts.get(year) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year)
}

/**
 * Which calendar year an entry belongs to, or `null` when its timestamp can't be
 * parsed.
 *
 * @param entry The history entry to place.
 * @param clock Zone the year boundary is measured in; defaults to Pacific (#429).
 */
export function workoutYear(
  entry: WorkoutHistoryEntry,
  clock: DayClock = PACIFIC_CLOCK
): number | null {
  const dayKey = clock.safeDayKey(entry.workout.started_at)
  if (dayKey === '') return null
  const year = Number(dayKey.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

/** One page of history, plus what the caller needs to render pagination. */
export interface WorkoutPage {
  /** Entries on this page. */
  entries: WorkoutHistoryEntry[]
  /** 1-based page number, clamped into range. */
  page: number
  /** Total pages; at least `1` even when there are no entries. */
  totalPages: number
  /** Entries across every page. */
  totalEntries: number
  /**
   * 1-based index of the first entry on this page, for a "showing 51–100 of
   * 507" line. `0` when there are no entries at all.
   *
   * Reported here rather than derived at the render site from
   * {@link WORKOUT_PAGE_SIZE}: this function takes a page size, so a caller
   * passing a custom one would silently get a caption that disagreed with the
   * rows beneath it.
   */
  startIndex: number
}

/**
 * Slice history into a page.
 *
 * Clamps rather than erroring: `?page=999` on a two-page list lands on page 2,
 * and `?page=-3` lands on page 1. A stale or hand-edited link should show
 * something rather than an error, and there's no correct "not found" for a page
 * number that merely ran off the end of a list that shrinks as filters change.
 *
 * @param entries Already-filtered entries, newest first.
 * @param requestedPage 1-based page, from the URL. Non-numeric falls back to 1.
 * @param pageSize Rows per page; defaults to {@link WORKOUT_PAGE_SIZE}.
 */
export function paginateWorkouts(
  entries: readonly WorkoutHistoryEntry[],
  requestedPage: number,
  pageSize: number = WORKOUT_PAGE_SIZE
): WorkoutPage {
  const size = Math.max(1, Math.floor(pageSize))
  const totalPages = Math.max(1, Math.ceil(entries.length / size))
  const page = Number.isFinite(requestedPage)
    ? Math.min(totalPages, Math.max(1, Math.floor(requestedPage)))
    : 1
  const start = (page - 1) * size
  const sliced = entries.slice(start, start + size)
  return {
    entries: sliced,
    page,
    totalPages,
    totalEntries: entries.length,
    startIndex: sliced.length === 0 ? 0 : start + 1,
  }
}
