import { describe, expect, it } from 'vitest'

import {
  buildWorkoutAdherence,
  buildWorkoutHistory,
  buildWorkoutSummary,
  compareToPrevious,
  findPersonalBests,
  findPreviousRun,
} from '@/lib/training-facility/workout-stats'

import { buildWorkoutDemoData } from './weight-room-demo-fixture'

/**
 * The workout preview fixture (#377) earns its keep only if it exercises every
 * branch of the summary — that is the whole reason it exists instead of seeded
 * database rows. These assertions are what stop it from quietly degrading into
 * a bland two-session sample that renders none of the interesting states.
 */

const NOW = new Date('2026-08-01T12:00:00-07:00')

describe('buildWorkoutDemoData', () => {
  const demo = buildWorkoutDemoData(NOW)
  const history = buildWorkoutHistory(demo.workouts, demo.sets, demo.templates, demo.exercises, NOW)
  const [latest, previous] = history

  it('produces two completed sessions, newest first', () => {
    expect(history).toHaveLength(2)
    expect(latest.summary.isInProgress).toBe(false)
    expect(latest.summary.durationMinutes).toBeGreaterThan(0)
    expect(new Date(latest.workout.started_at).getTime()).toBeGreaterThan(
      new Date(previous.workout.started_at).getTime()
    )
  })

  it('links every set to a session, so nothing leaks into the loose grease-the-groove log', () => {
    expect(demo.sets.every(s => s.workout_id !== undefined)).toBe(true)
  })

  it('renders a substituted slot — the case the whole arc exists for', () => {
    const adherence = buildWorkoutAdherence(
      demo.templates[0],
      demo.sets.filter(s => s.workout_id === latest.workout.id)
    )
    expect(adherence.substitutedSlots).toBe(1)
    const swapped = adherence.slots.find(s => s.isSubstituted)
    expect(swapped?.performedExercise).toBe('dumbbell-bench-press')
    expect(swapped?.slot.exercise).toBe('barbell-bench-press')
  })

  it('renders a slot that came up short, and extra work off-template', () => {
    const adherence = buildWorkoutAdherence(
      demo.templates[0],
      demo.sets.filter(s => s.workout_id === latest.workout.id)
    )
    expect(adherence.slots.some(s => s.shortfall > 0)).toBe(true)
    expect(adherence.completion).toBeLessThan(1)
    expect(adherence.extra.length).toBeGreaterThan(0)
  })

  it('mixes bodyweight and loaded work so the tonnage caveat renders', () => {
    expect(latest.summary.tonnage).toBeGreaterThan(0)
    expect(latest.summary.bodyweightSets).toBeGreaterThan(0)
    expect(latest.summary.weightedSets).toBeGreaterThan(0)
  })

  it('counts a two-dumbbell movement through its multiplier', () => {
    const incline = latest.summary.exercises.find(e => e.exercise === 'incline-dumbbell-press')
    // 55 lb per hand, carried two at a time.
    expect(incline?.topSet?.effectiveLoad).toBe(110)
  })

  it('gives the comparison block something to compare', () => {
    const previousRun = findPreviousRun(latest.workout, demo.workouts)
    expect(previousRun?.id).toBe(previous.workout.id)
    const comparison = compareToPrevious(latest.summary, previous.summary)
    expect(comparison).not.toBeNull()
    // The incline went up 5 lb a hand between the two sessions.
    const incline = comparison?.exercises.find(e => e.exercise === 'incline-dumbbell-press')
    expect(incline?.topSetLoadDelta).toBe(10)
  })

  it('sets an all-time best, so the PR strip renders', () => {
    const bests = findPersonalBests(
      latest.summary,
      demo.sets.filter(s => s.workout_id !== latest.workout.id),
      demo.exercises
    )
    expect(bests.length).toBeGreaterThan(0)
  })

  it('carries a frozen prescription, so the preview exercises the snapshot path', () => {
    for (const workout of demo.workouts) {
      expect(workout.prescription).toBeDefined()
      expect(workout.prescription?.name).toBe('Chest Day 1')
      expect(workout.prescription?.slots).toHaveLength(demo.templates[0].slots.length)
    }
  })

  it('keeps ids stable across builds so a preview link survives a re-render', () => {
    const again = buildWorkoutDemoData(NOW)
    expect(again.workouts.map(w => w.id)).toEqual(demo.workouts.map(w => w.id))
  })

  it('names every movement it uses in the catalog it ships', () => {
    const known = new Set(demo.exercises.map(e => e.slug))
    for (const set of demo.sets) expect(known.has(set.exercise)).toBe(true)
    for (const slot of demo.templates[0].slots) expect(known.has(slot.exercise)).toBe(true)
  })

  it('summarizes without a catalog too, just at single-implement loads', () => {
    const withoutCatalog = buildWorkoutSummary(
      latest.workout,
      demo.sets.filter(s => s.workout_id === latest.workout.id),
      []
    )
    expect(withoutCatalog.tonnage).toBeLessThan(latest.summary.tonnage)
  })
})
