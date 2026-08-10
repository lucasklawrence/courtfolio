/**
 * Per-template aggregation for the template detail page (#446).
 *
 * The Weight Room could show a movement's trend (#412) and a single session's
 * breakdown (#377), but nothing answered "how is *Chest Day 1* going" — which
 * is the unit training is actually planned in. This turns the run history of
 * one template into the two things that question needs: a per-session series
 * for the workout as a whole, and the roster of movements that actually ran
 * under it.
 *
 * **Composition comes from the log, not the prescription.** Templates drift —
 * across this log fifteen movements were logged under templates that no longer
 * list them, and one is prescribed but was never run. Deriving the movement
 * panels from the current slots would erase most of the history the page exists
 * to show, and would do it silently, the day someone edits a template.
 */
import type { WorkoutTemplate } from '@/types/weight-room'

import { PACIFIC_CLOCK, type DayClock } from './clock'
import { isMeasuredWindow } from './training-program'
import type { WorkoutHistoryEntry } from './workout-stats'

/**
 * Derive a URL slug from a template name — lowercase, non-alphanumeric runs
 * collapsed to single hyphens, ends trimmed. `Chest Day 1` → `chest-day-1`.
 *
 * Mirrors the exercise catalog's own slug rule so the two read alike in a URL.
 */
export function templateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The URL segment that unambiguously addresses one template.
 *
 * Prefers the readable slug, but only when it actually resolves *back* to this
 * template. Names are editable and explicitly not unique, so two failure modes
 * are real rather than theoretical: two templates sharing a name would both
 * slugify the same way and {@link resolveTemplate} would hand every link to
 * whichever has the lower position, and a name with no alphanumerics at all
 * slugifies to the empty string, producing a href that matches no route.
 *
 * Either case falls back to the id, which {@link resolveTemplate} also accepts.
 * Ugly beats wrong.
 *
 * @param template The template to address; only `id` and `name` are read.
 * @param all Every template in scope, to detect a shared slug.
 */
export function templateSegment(
  template: { id: string; name: string },
  all: readonly { id: string; name: string }[]
): string {
  const slug = templateSlug(template.name)
  if (slug === '') return template.id
  const shared = all.some(other => other.id !== template.id && templateSlug(other.name) === slug)
  return shared ? template.id : slug
}

/**
 * Find the template a URL segment names.
 *
 * Matches the derived slug first, then falls back to the raw id — template
 * names are not guaranteed unique and are editable, so the UUID stays a valid
 * address for a template whose name has changed or collided.
 *
 * @param segment The `[slug]` route param, already lowercased by the caller.
 * @param templates Every template, in roster order.
 * @returns The match, or `null`. On a slug collision the earliest by
 *   `position` wins, so the choice is stable across requests rather than
 *   dependent on fetch order; the loser stays reachable by id.
 */
export function resolveTemplate(
  segment: string,
  templates: readonly WorkoutTemplate[]
): WorkoutTemplate | null {
  const bySlug = templates
    .filter(t => templateSlug(t.name) === segment)
    .sort((a, b) => a.position - b.position)
  return bySlug[0] ?? templates.find(t => t.id === segment) ?? null
}

/** One run of a template, as a point on the whole-workout series. */
export interface TemplateRunPoint {
  /** Pacific day the session belongs to. */
  dayKey: string
  /** That day at local noon, for a time axis. */
  date: Date
  /** Session id, for linking to its summary. */
  workoutId: string
  /** Total load moved, in pounds. */
  tonnage: number
  /** Sets recorded. */
  totalSets: number
  /** Reps recorded. */
  totalReps: number
  /**
   * Wall-clock minutes, or `null` when the session doesn't carry a trustworthy
   * one. See {@link TemplateHistory.durations} for which sessions qualify.
   */
  durationMinutes: number | null
}

/** One movement that has run under a template. */
export interface TemplateMovement {
  /** Catalog slug. */
  exercise: string
  /** Sessions of this template that included it. */
  runs: number
  /** Sets across those sessions. */
  sets: number
  /** Reps across those sessions. */
  reps: number
  /** Load moved across those sessions, in pounds. */
  tonnage: number
  /**
   * Whether the template still prescribes it. `false` means it ran historically
   * but has since been dropped — kept and labelled rather than hidden, because
   * those sessions happened.
   */
  prescribed: boolean
}

/** Everything the template detail page renders. */
export interface TemplateHistory {
  /** The template these runs belong to. */
  template: WorkoutTemplate
  /** Every run, oldest first — the x-axis of every whole-workout chart. */
  runs: TemplateRunPoint[]
  /**
   * Runs carrying a trustworthy duration, oldest first. A subset of
   * {@link runs}, narrowed for two distinct reasons — see
   * {@link noteTimedRuns} and {@link untimedRuns}, which are reported
   * separately so a caller can say *why* rather than guess.
   */
  durations: TemplateRunPoint[]
  /**
   * Runs left out of {@link durations} because their window isn't a
   * measurement: an `icloud_notes` session's start and end are the *note's*
   * create and edit times, so its "duration" measures typing, not training.
   */
  noteTimedRuns: number
  /**
   * Runs left out of {@link durations} because they carry no duration at all —
   * a session still in progress, or one abandoned without an end.
   */
  untimedRuns: number
  /** Movements that ran, most total tonnage first. */
  movements: TemplateMovement[]
  /** Movements the template prescribes that have never been logged under it. */
  neverRun: string[]
  /** Pacific day of the earliest run, or `''` when there are none. */
  firstDayKey: string
  /** Pacific day of the most recent run, or `''` when there are none. */
  lastDayKey: string
}

/**
 * Aggregate one template's run history.
 *
 * @param template The template to summarize.
 * @param history Every session, from `buildWorkoutHistory`; filtered to this
 *   template internally so callers can build the history once per page.
 * @param clock Zone each day is measured in; defaults to Pacific (#429).
 */
export function buildTemplateHistory(
  template: WorkoutTemplate,
  history: readonly WorkoutHistoryEntry[],
  clock: DayClock = PACIFIC_CLOCK
): TemplateHistory {
  const runs: TemplateRunPoint[] = []
  const durations: TemplateRunPoint[] = []
  const byMovement = new Map<string, TemplateMovement>()
  let noteTimedRuns = 0
  let untimedRuns = 0

  const mine = history.filter(entry => entry.workout.template_id === template.id)
  for (const entry of mine) {
    const dayKey = clock.safeDayKey(entry.workout.started_at)
    if (dayKey === '') continue
    const date = clock.toNoon(dayKey)
    if (date === null) continue

    const point: TemplateRunPoint = {
      dayKey,
      date,
      workoutId: entry.workout.id,
      tonnage: entry.summary.tonnage,
      totalSets: entry.summary.totalSets,
      totalReps: entry.summary.totalReps,
      durationMinutes: entry.summary.durationMinutes,
    }
    runs.push(point)
    // Order matters for the tally: an unmeasured window is the more specific
    // reason, so a note-timed session is counted there rather than twice.
    if (!isMeasuredWindow(entry.workout)) noteTimedRuns += 1
    else if (point.durationMinutes === null) untimedRuns += 1
    else durations.push(point)

    for (const breakdown of entry.summary.exercises) {
      const existing = byMovement.get(breakdown.exercise) ?? {
        exercise: breakdown.exercise,
        runs: 0,
        sets: 0,
        reps: 0,
        tonnage: 0,
        prescribed: false,
      }
      existing.runs += 1
      existing.sets += breakdown.sets
      existing.reps += breakdown.reps
      existing.tonnage += breakdown.tonnage
      byMovement.set(breakdown.exercise, existing)
    }
  }

  runs.sort((a, b) => a.dayKey.localeCompare(b.dayKey))
  durations.sort((a, b) => a.dayKey.localeCompare(b.dayKey))

  const prescribed = new Set(template.slots.map(slot => slot.exercise))
  for (const movement of byMovement.values()) {
    movement.prescribed = prescribed.has(movement.exercise)
  }

  const movements = [...byMovement.values()].sort(
    (a, b) => b.tonnage - a.tonnage || b.reps - a.reps || a.exercise.localeCompare(b.exercise)
  )
  const neverRun = [...prescribed].filter(slug => !byMovement.has(slug)).sort()

  return {
    template,
    runs,
    durations,
    noteTimedRuns,
    untimedRuns,
    movements,
    neverRun,
    firstDayKey: runs[0]?.dayKey ?? '',
    lastDayKey: runs[runs.length - 1]?.dayKey ?? '',
  }
}

/**
 * Ids of the sessions that ran a template.
 *
 * Used to narrow the global set list before handing it to
 * `buildExerciseProgression`, so a movement's panel on this page trends only
 * the work done *in this workout* rather than everywhere it appears.
 */
export function templateRunIds(history: TemplateHistory): Set<string> {
  return new Set(history.runs.map(run => run.workoutId))
}
