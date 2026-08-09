import type { WeightRoomWorkout, WorkoutTemplate } from '@/types/weight-room'

import { PACIFIC_CLOCK, type DayClock } from './clock'
import { workoutDurationMinutes } from './workout-sessions'

/**
 * The training programme behind the sessions (#436).
 *
 * Every other Weight Room surface works at the altitude of a session or a
 * movement. This one works at the altitude of the *plan*: which template ran
 * when, how strictly the rotation held, and how long each kind of session
 * actually took.
 *
 * That question only became answerable with #400. The archive is 133 sessions
 * across 2023-2024, each titled with the template it ran and most carrying an
 * Apple Health duration because the note was typed during the workout. The
 * current log has no templates at all, so this says nothing about it — which is
 * itself worth stating rather than rendering as an empty rotation.
 *
 * **The rotation is inferred, not configured.** `weight_room_workout_templates`
 * has a `position`, but it orders the six as Chest 1, Chest 2, Back 1, Back 2,
 * Legs 1, Legs 2 — which is a sensible way to *list* them and not the order they
 * were *run*. The sessions say the cycle was Chest 1 → Back 1 → Legs 1 →
 * Chest 2 → Back 2 → Legs 2, and reading it off the data means the answer stays
 * right if the programme changes, and never contradicts the log to match a
 * column nobody maintained for this purpose.
 *
 * Pure and isomorphic, like its siblings — no Supabase client, no React, and no
 * clock beyond the zone it is handed.
 */

/** One template's record across the archive. */
export interface TemplateSummary {
  /** Template id, for keying and links. */
  id: string
  /** Human-readable name, e.g. `Back Day 1`. */
  name: string
  /** Sessions that ran it. */
  sessions: number
  /** First day it was run, `YYYY-MM-DD`. */
  firstDayKey: string
  /** Last day it was run, `YYYY-MM-DD`. */
  lastDayKey: string
  /**
   * Median session length in minutes, or `null` when no session of this
   * template has both a start and an end.
   *
   * Median rather than mean: a session left running on the watch skews an
   * average badly, and one forgotten stop should not redefine how long a
   * Back Day takes.
   */
  medianMinutes: number | null
}

/** How faithfully the sessions followed the rotation. */
export interface RotationAdherence {
  /** Transitions that went to the next template in the cycle. */
  followed: number
  /** Transitions considered — one fewer than the number of templated sessions. */
  total: number
  /** {@link followed} over {@link total}, `0` when there are no transitions. */
  rate: number
}

/** Sessions in one calendar month. */
export interface ProgramMonth {
  /** `YYYY-MM`. */
  monthKey: string
  /** Templated sessions that month. */
  sessions: number
}

/** The programme as the sessions actually record it. */
export interface ProgramSummary {
  /** Per-template records, in rotation order. */
  templates: TemplateSummary[]
  /**
   * Template names in the order the log says they were cycled.
   *
   * Empty when no repeating order could be read — a handful of sessions with no
   * consistent successor is not a rotation, and inventing one from noise would
   * make the adherence figure meaningless.
   */
  rotation: string[]
  /** How closely the sessions followed {@link rotation}. */
  adherence: RotationAdherence
  /** Templated sessions per month, oldest first, including months with none. */
  months: ProgramMonth[]
  /** Total templated sessions. */
  totalSessions: number
  /** First and last templated day, `YYYY-MM-DD`; both `null` when there are none. */
  firstDayKey: string | null
  lastDayKey: string | null
}

/**
 * The middle value of a list, averaging the two middles when it is even.
 *
 * @param values Numbers to summarize; not mutated.
 * @returns The median, or `null` for an empty list.
 */
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Read the repeating cycle out of the order templates were actually run.
 *
 * Each template's most frequent successor is taken as its place in the cycle,
 * then the chain is walked from the most-used template until it returns to
 * where it started. Deviations — a repeated day, a skipped one — are outvoted
 * rather than breaking the chain, which is what makes this robust on a log that
 * followed the plan about 92% of the time.
 *
 * @param sequence Template names in the order they were run, oldest first.
 * @returns The cycle as an ordered list, or `[]` when the walk does not close
 *   into one. A programme with no repeating order genuinely has no rotation,
 *   and a partial chain would make adherence measure nothing.
 */
export function inferRotation(sequence: readonly string[]): string[] {
  if (sequence.length < 2) return []

  const successors = new Map<string, Map<string, number>>()
  const distinct = new Set<string>()
  for (let i = 0; i < sequence.length; i += 1) {
    const name = sequence[i]
    distinct.add(name)
    const next = sequence[i + 1]
    if (next === undefined || next === name) continue
    const counts = successors.get(name) ?? new Map<string, number>()
    counts.set(next, (counts.get(next) ?? 0) + 1)
    successors.set(name, counts)
  }

  /** The successor a template most often had, ties broken alphabetically. */
  const bestSuccessor = (name: string): string | null => {
    const counts = successors.get(name)
    if (!counts || counts.size === 0) return null
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
  }

  // Start where the log starts. A cycle has no inherent beginning, so any
  // rotation of it is equally true — but reading it from the first session
  // means the order shown matches the order someone scrolling the log meets,
  // rather than an alphabetical accident.
  const start = sequence[0]

  const cycle: string[] = [start]
  const seen = new Set([start])
  let current = start
  while (cycle.length <= distinct.size) {
    const next = bestSuccessor(current)
    if (next === null) return []
    // Closed the loop — a genuine rotation.
    if (next === start) return cycle
    // Re-entered somewhere other than the start: the chain forks, so there is
    // no single cycle to report.
    if (seen.has(next)) return []
    cycle.push(next)
    seen.add(next)
    current = next
  }
  return []
}

/**
 * Count how many transitions followed the rotation.
 *
 * @param sequence Template names in the order they were run, oldest first.
 * @param rotation The cycle, as produced by {@link inferRotation}.
 * @returns Followed, total, and the rate. All zero when there is no rotation.
 */
export function rotationAdherence(
  sequence: readonly string[],
  rotation: readonly string[]
): RotationAdherence {
  if (rotation.length === 0 || sequence.length < 2) {
    return { followed: 0, total: 0, rate: 0 }
  }
  const nextOf = new Map(rotation.map((name, i) => [name, rotation[(i + 1) % rotation.length]]))

  let followed = 0
  let total = 0
  for (let i = 0; i + 1 < sequence.length; i += 1) {
    const expected = nextOf.get(sequence[i])
    if (expected === undefined) continue
    total += 1
    if (sequence[i + 1] === expected) followed += 1
  }
  return { followed, total, rate: total === 0 ? 0 : followed / total }
}

/**
 * Every `YYYY-MM` from one month to another, inclusive.
 *
 * Months with no sessions are included deliberately: a gap in training is the
 * most interesting thing a cadence chart can show, and omitting empty months
 * would draw a continuous line straight over it.
 */
function monthRange(firstMonth: string, lastMonth: string): string[] {
  const [startYear, startMonth] = firstMonth.split('-').map(Number)
  const [endYear, endMonth] = lastMonth.split('-').map(Number)
  const months: string[] = []
  let year = startYear
  let month = startMonth
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return months
}

/**
 * Summarize the programme the templated sessions record.
 *
 * @param workouts Every session. Ones with no `template_id` are ignored — the
 *   current era's grease-the-groove logging has no programme to describe, and
 *   folding it in would dilute both the cadence and the adherence.
 * @param templates The template roster, for names.
 * @param clock Zone every day and month is measured in; defaults to Pacific (#429).
 * @returns The summary, or `null` when no session names a template.
 */
export function buildProgramSummary(
  workouts: readonly WeightRoomWorkout[],
  templates: readonly WorkoutTemplate[],
  clock: DayClock = PACIFIC_CLOCK
): ProgramSummary | null {
  const nameById = new Map(templates.map(template => [template.id, template.name]))

  const templated = workouts
    .filter(workout => workout.template_id !== undefined && nameById.has(workout.template_id))
    .map(workout => ({
      workout,
      name: nameById.get(workout.template_id as string) as string,
      dayKey: clock.safeDayKey(workout.started_at),
    }))
    .filter(entry => entry.dayKey !== '')
    // `started_at` is an instant, so string comparison orders it correctly.
    .sort((a, b) => a.workout.started_at.localeCompare(b.workout.started_at))

  if (templated.length === 0) return null

  const sequence = templated.map(entry => entry.name)
  const rotation = inferRotation(sequence)
  const adherence = rotationAdherence(sequence, rotation)

  const byTemplate = new Map<string, typeof templated>()
  for (const entry of templated) {
    const list = byTemplate.get(entry.name)
    if (list) list.push(entry)
    else byTemplate.set(entry.name, [entry])
  }

  const summaries: TemplateSummary[] = []
  for (const [name, entries] of byTemplate) {
    const id = entries[0].workout.template_id as string
    const days = entries.map(entry => entry.dayKey).sort()
    const minutes = entries
      .map(entry => workoutDurationMinutes(entry.workout))
      .filter((value): value is number => value !== null && value > 0)

    summaries.push({
      id,
      name,
      sessions: entries.length,
      firstDayKey: days[0],
      lastDayKey: days[days.length - 1],
      medianMinutes: median(minutes),
    })
  }

  // Rotation order where there is one, so the table reads as the cycle rather
  // than as an arbitrary list; alphabetical otherwise.
  const rank = new Map(rotation.map((name, i) => [name, i]))
  summaries.sort(
    (a, b) =>
      (rank.get(a.name) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.name) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)
  )

  const countByMonth = new Map<string, number>()
  for (const entry of templated) {
    const monthKey = entry.dayKey.slice(0, 7)
    countByMonth.set(monthKey, (countByMonth.get(monthKey) ?? 0) + 1)
  }
  const allDays = templated.map(entry => entry.dayKey).sort()
  const months = monthRange(allDays[0].slice(0, 7), allDays[allDays.length - 1].slice(0, 7)).map(
    monthKey => ({ monthKey, sessions: countByMonth.get(monthKey) ?? 0 })
  )

  return {
    templates: summaries,
    rotation,
    adherence,
    months,
    totalSessions: templated.length,
    firstDayKey: allDays[0],
    lastDayKey: allDays[allDays.length - 1],
  }
}
