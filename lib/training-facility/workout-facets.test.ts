/**
 * Tests for the session log's filter faceting (#445).
 *
 * The bug these pin: every chip counted the whole history while the list was
 * filtered, and the year axis defaults to the newest year — so the source rail
 * advertised 507 Apple Health sessions above a list of 22. The cases below are
 * all about one axis's count respecting the *other* axes.
 */
import { describe, expect, it } from 'vitest'

import type { WorkoutHistoryEntry } from './workout-stats'

import { facetCount, filterWorkouts, matchesWorkoutFilters } from './workout-facets'

/** A history entry with just the fields the facets read. */
function entry(
  id: string,
  startedAt: string,
  source: 'manual' | 'apple_health',
  templateId?: string
): WorkoutHistoryEntry {
  return {
    workout: {
      id,
      started_at: startedAt,
      source,
      ...(templateId === undefined ? {} : { template_id: templateId }),
    },
  } as unknown as WorkoutHistoryEntry
}

/**
 * A log shaped like the real one: a large imported archive across old years,
 * and a small recorded population in the current year.
 */
const HISTORY: WorkoutHistoryEntry[] = [
  entry('r1', '2026-08-01T18:00:00Z', 'manual', 'chest-1'),
  entry('r2', '2026-08-03T18:00:00Z', 'manual', 'chest-1'),
  entry('r3', '2026-07-20T18:00:00Z', 'manual', 'legs'),
  entry('i1', '2026-02-10T18:00:00Z', 'apple_health'),
  entry('i2', '2023-05-05T18:00:00Z', 'apple_health'),
  entry('i3', '2023-06-06T18:00:00Z', 'apple_health'),
  entry('o1', '2023-04-04T18:00:00Z', 'manual', 'chest-1'),
]

const ALL = { templateId: null, year: null, source: null } as const

describe('matchesWorkoutFilters', () => {
  it('matches everything when no axis is set', () => {
    expect(HISTORY.every(e => matchesWorkoutFilters(e, ALL))).toBe(true)
  })

  it('places a session in its Pacific year, not its UTC one', () => {
    // 2026-01-01 03:00 UTC is still Dec 31 2025 in Pacific.
    const newYear = entry('ny', '2026-01-01T03:00:00Z', 'manual')
    expect(matchesWorkoutFilters(newYear, { ...ALL, year: 2025 })).toBe(true)
    expect(matchesWorkoutFilters(newYear, { ...ALL, year: 2026 })).toBe(false)
  })

  it('treats a missing template as matching no template filter', () => {
    expect(matchesWorkoutFilters(HISTORY[3], { ...ALL, templateId: 'chest-1' })).toBe(false)
  })
})

describe('filterWorkouts', () => {
  it('applies every axis together', () => {
    const got = filterWorkouts(HISTORY, { templateId: 'chest-1', year: 2026, source: 'recorded' })
    expect(got.map(e => e.workout.id)).toEqual(['r1', 'r2'])
  })

  it('preserves input order', () => {
    const got = filterWorkouts(HISTORY, { ...ALL, source: 'imported' })
    expect(got.map(e => e.workout.id)).toEqual(['i1', 'i2', 'i3'])
  })
})

describe('facetCount', () => {
  it('counts a source chip within the selected year, not the whole log', () => {
    // The reported bug, in miniature: 3 imported sessions exist, but only 1 is
    // in 2026, and 2026 is what the list is showing.
    const state = { templateId: null, year: 2026, source: null }
    expect(facetCount(HISTORY, state, { source: 'imported' })).toBe(1)
    expect(facetCount(HISTORY, state, { source: 'recorded' })).toBe(3)
    expect(facetCount(HISTORY, state, { source: null })).toBe(4)
  })

  it('counts a year chip within the selected source', () => {
    const state = { templateId: null, year: 2026, source: 'recorded' as const }
    expect(facetCount(HISTORY, state, { year: 2023 })).toBe(1)
    expect(facetCount(HISTORY, state, { year: null })).toBe(4)
  })

  it('counts a template chip within the selected year', () => {
    const state = { templateId: null, year: 2026, source: null }
    expect(facetCount(HISTORY, state, { templateId: 'chest-1' })).toBe(2)
    // Ran only in 2023, so it is unreachable from the 2026 view.
    expect(facetCount(HISTORY, state, { templateId: 'legs' })).toBe(1)
  })

  it('reports zero for a template with no sessions under the other axes', () => {
    const state = { templateId: null, year: 2026, source: 'imported' as const }
    expect(facetCount(HISTORY, state, { templateId: 'chest-1' })).toBe(0)
  })

  it('ignores the axis the chip replaces', () => {
    // A template chip's count must not be narrowed by the template already
    // selected, or every unselected chip reads zero.
    const state = { templateId: 'legs', year: null, source: null }
    expect(facetCount(HISTORY, state, { templateId: 'chest-1' })).toBe(3)
  })

  it('equals the length of the list the chip navigates to', () => {
    // The invariant the whole module exists for.
    const state = { templateId: null, year: 2026, source: null }
    const override = { source: 'imported' as const }
    expect(facetCount(HISTORY, state, override)).toBe(
      filterWorkouts(HISTORY, { ...state, ...override }).length
    )
  })
})
