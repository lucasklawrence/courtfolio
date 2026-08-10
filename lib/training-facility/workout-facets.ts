/**
 * Faceting for the session log's three filter axes (#445).
 *
 * The log filters by template (#377), source (#413), and year (#416), and each
 * chip carries a count. Those counts were tallied over the whole history while
 * the list was filtered — and because the year axis defaults to the newest year
 * rather than to everything, the two disagreed on first paint with no
 * interaction at all: the source rail read "Apple Health 507" above a list of 22.
 *
 * A count on a filter chip is a promise about what clicking it returns. Keeping
 * that promise means counting each chip against the history filtered by the
 * *other* two axes — which is what {@link facetCount} does, and why the
 * predicate lives in one place instead of being restated per rail.
 */
import { PACIFIC_CLOCK, type DayClock } from './clock'
import type { WorkoutHistoryEntry } from './workout-stats'
import { workoutYear } from './workout-stats'

/**
 * Provenance selection.
 *
 * `'recorded'` — logged set by set through the app. `'imported'` — from an
 * Apple Health export, which knows only that lifting happened and for how long.
 */
export type WorkoutSourceFilter = 'recorded' | 'imported'

/** The session log's full filter state. Every axis, `null` meaning unfiltered. */
export interface WorkoutFilterState {
  /** Template id, or `null` for every template. */
  templateId: string | null
  /** Calendar year, or `null` for every year. */
  year: number | null
  /** Provenance, or `null` for both. */
  source: WorkoutSourceFilter | null
}

/** Which axes a facet query holds fixed. */
export type WorkoutFilterAxis = keyof WorkoutFilterState

/** Whether `entry` is an Apple Health import rather than an in-app recording. */
export function isImported(entry: WorkoutHistoryEntry): boolean {
  return entry.workout.source === 'apple_health'
}

/**
 * Whether an entry survives every axis of `state`.
 *
 * @param entry The session to test.
 * @param state Filter state; a `null` axis matches everything.
 * @param clock Zone the year boundary is measured in; defaults to Pacific (#429).
 */
export function matchesWorkoutFilters(
  entry: WorkoutHistoryEntry,
  state: WorkoutFilterState,
  clock: DayClock = PACIFIC_CLOCK
): boolean {
  if (state.templateId !== null && entry.workout.template_id !== state.templateId) return false
  if (state.year !== null && workoutYear(entry, clock) !== state.year) return false
  if (state.source !== null && isImported(entry) !== (state.source === 'imported')) return false
  return true
}

/**
 * Apply every axis of `state`.
 *
 * @param entries History entries, in any order; order is preserved.
 * @param state Filter state; a `null` axis matches everything.
 * @param clock Zone the year boundary is measured in; defaults to Pacific (#429).
 */
export function filterWorkouts(
  entries: readonly WorkoutHistoryEntry[],
  state: WorkoutFilterState,
  clock: DayClock = PACIFIC_CLOCK
): WorkoutHistoryEntry[] {
  return entries.filter(entry => matchesWorkoutFilters(entry, state, clock))
}

/**
 * How many sessions a chip would show if it were clicked.
 *
 * The chip's own axis is replaced by the value it selects; the other axes stay
 * as they are. That is exactly the state the link navigates to, so the number
 * and the resulting page cannot disagree.
 *
 * @param entries The full history, before any filtering.
 * @param state The currently active filter state.
 * @param override The single axis this chip changes, e.g. `{ source: 'imported' }`.
 * @param clock Zone the year boundary is measured in; defaults to Pacific (#429).
 */
export function facetCount(
  entries: readonly WorkoutHistoryEntry[],
  state: WorkoutFilterState,
  override: Partial<WorkoutFilterState>,
  clock: DayClock = PACIFIC_CLOCK
): number {
  const next = { ...state, ...override }
  let count = 0
  for (const entry of entries) {
    if (matchesWorkoutFilters(entry, next, clock)) count += 1
  }
  return count
}
