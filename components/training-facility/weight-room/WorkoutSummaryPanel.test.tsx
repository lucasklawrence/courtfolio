import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  buildWorkoutAdherence,
  buildWorkoutSummary,
  compareToPrevious,
  findPersonalBests,
} from '@/lib/training-facility/workout-stats'
import type {
  StrengthSet,
  WeightRoomExercise,
  WeightRoomWorkout,
  WorkoutTemplate,
} from '@/types/weight-room'

import { WorkoutSummaryPanel } from './WorkoutSummaryPanel'

/**
 * Rendering coverage for the workout summary (#377).
 *
 * The arithmetic is covered in `workout-stats.test.ts`; what these assert is
 * the part a reader can be actively misled by — that a bodyweight session says
 * *why* its tonnage is missing rather than printing a bare zero, and that a
 * substituted slot reads as a substitution rather than as a failure.
 */

const CATALOG: WeightRoomExercise[] = [
  {
    slug: 'barbell-bench-press',
    display_name: 'Barbell Bench Press',
    equipment: 'barbell',
    muscle_group: 'chest',
  },
  {
    slug: 'dumbbell-bench-press',
    display_name: 'Dumbbell Bench Press',
    equipment: 'dumbbell',
    muscle_group: 'chest',
    load_multiplier: 2,
  },
  { slug: 'dips', display_name: 'Dips', equipment: 'bodyweight', muscle_group: 'chest' },
]

const LABELS = Object.fromEntries(CATALOG.map(e => [e.slug, e.display_name]))

const WORKOUT: WeightRoomWorkout = {
  id: 'w1',
  started_at: '2026-08-01T18:00:00Z',
  ended_at: '2026-08-01T19:00:00Z',
  template_id: 't1',
}

const TEMPLATE: WorkoutTemplate = {
  id: 't1',
  name: 'Chest Day 1',
  position: 0,
  slots: [
    {
      id: 'slot-bench',
      position: 0,
      exercise: 'barbell-bench-press',
      target_sets: 4,
      target_reps: 8,
      steps: [],
      alternates: [],
    },
  ],
}

function set(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return {
    id: 'set-1',
    logged_at: '2026-08-01T18:10:00Z',
    exercise: 'barbell-bench-press',
    reps: 8,
    weight_lbs: 155,
    workout_id: 'w1',
    ...overrides,
  }
}

function renderPanel(sets: StrengthSet[], template: WorkoutTemplate | null = TEMPLATE): void {
  const summary = buildWorkoutSummary(WORKOUT, sets, CATALOG)
  render(
    <WorkoutSummaryPanel
      summary={summary}
      adherence={template === null ? null : buildWorkoutAdherence(template, sets)}
      comparison={null}
      personalBests={findPersonalBests(summary, [], CATALOG)}
      templateName={template?.name ?? null}
      exerciseLabels={LABELS}
    />
  )
}

describe('WorkoutSummaryPanel', () => {
  it('states why a bodyweight session has no tonnage instead of showing a bare zero', () => {
    renderPanel([set({ id: 's1', exercise: 'dips', reps: 12, weight_lbs: undefined })], null)
    expect(screen.getByTestId('workout-tonnage')).toHaveTextContent('—')
    expect(screen.getByTestId('workout-bodyweight-note')).toHaveTextContent(/no external load/i)
  })

  it('says how many sets were bodyweight in a mixed session', () => {
    renderPanel(
      [set({ id: 's1' }), set({ id: 's2', exercise: 'dips', reps: 12, weight_lbs: undefined })],
      null
    )
    expect(screen.getByTestId('workout-bodyweight-note')).toHaveTextContent(
      /1 of 2 sets were bodyweight/i
    )
  })

  it('does not call an empty session a bodyweight session', () => {
    // Reachable: end a workout without logging anything. `weightedSets === 0`
    // is true here too, so the caveat would contradict the breakdown's "no sets
    // logged into this session" directly below it.
    renderPanel([], null)
    expect(screen.queryByTestId('workout-bodyweight-note')).toBeNull()
    expect(screen.getByTestId('workout-breakdown-empty')).toBeInTheDocument()
  })

  it('labels a swapped slot as a substitution and still counts it complete', () => {
    renderPanel(
      Array.from({ length: 4 }, (_, i) =>
        set({ id: `s${i}`, exercise: 'dumbbell-bench-press', template_slot_id: 'slot-bench' })
      )
    )
    const slot = screen.getByTestId('workout-slot-slot-bench')
    expect(slot).toHaveAttribute('data-substituted', 'true')
    expect(slot).toHaveAttribute('data-complete', 'true')
    expect(slot).toHaveTextContent(/swapped from Barbell Bench Press/i)
    expect(screen.getByTestId('workout-completion')).toHaveTextContent('100%')
  })

  it('shows a shortfall without calling it a failure', () => {
    renderPanel([
      set({ id: 's1', template_slot_id: 'slot-bench' }),
      set({ id: 's2', template_slot_id: 'slot-bench' }),
    ])
    expect(screen.getByTestId('workout-slot-slot-bench')).toHaveAttribute('data-complete', 'false')
    expect(screen.getByTestId('workout-completion')).toHaveTextContent('50%')
  })

  it('files off-template sets under extra work', () => {
    renderPanel([
      set({ id: 's1', template_slot_id: 'slot-bench' }),
      set({ id: 's2', exercise: 'dips', reps: 12, weight_lbs: undefined }),
    ])
    expect(screen.getByTestId('workout-extra-dips')).toHaveTextContent(/Dips/)
    expect(screen.getByTestId('workout-extra-dips')).toHaveTextContent(/1 set · 12 reps/)
  })

  it('renders no adherence block for a freestyle session', () => {
    renderPanel([set({ id: 's1' })], null)
    expect(screen.queryByTestId('workout-adherence')).toBeNull()
  })

  it('says a template has never been run before rather than showing empty deltas', () => {
    renderPanel([set({ id: 's1', template_slot_id: 'slot-bench' })])
    expect(screen.getByTestId('workout-no-comparison')).toHaveTextContent(/First recorded run/i)
    expect(screen.queryByTestId('workout-comparison')).toBeNull()
  })

  it('doubles a two-dumbbell top set through the catalog multiplier', () => {
    renderPanel(
      [set({ id: 's1', exercise: 'dumbbell-bench-press', reps: 8, weight_lbs: 65 })],
      null
    )
    // 65 per hand, carried two at a time.
    expect(screen.getByTestId('workout-breakdown-dumbbell-bench-press')).toHaveTextContent(
      '8 × 130 lb'
    )
  })

  it('marks a never-ended session as such rather than inventing a duration', () => {
    const summary = buildWorkoutSummary(
      { ...WORKOUT, ended_at: undefined },
      [set({ id: 's1' })],
      CATALOG,
      new Date('2026-08-03T18:00:00Z')
    )
    render(
      <WorkoutSummaryPanel
        summary={summary}
        adherence={null}
        comparison={null}
        personalBests={[]}
        templateName={null}
        exerciseLabels={LABELS}
      />
    )
    expect(screen.getByTestId('workout-duration')).toHaveTextContent('—')
    expect(screen.getByTestId('workout-in-progress')).toHaveTextContent(/never ended/i)
  })

  it('surfaces a comparison against the previous run', () => {
    const sets = [set({ id: 's1', reps: 8, weight_lbs: 185, template_slot_id: 'slot-bench' })]
    const summary = buildWorkoutSummary(WORKOUT, sets, CATALOG)
    const previous = buildWorkoutSummary(
      { id: 'w0', started_at: '2026-07-25T18:00:00Z', ended_at: '2026-07-25T19:00:00Z' },
      [set({ id: 'p1', workout_id: 'w0', reps: 8, weight_lbs: 155 })],
      CATALOG
    )
    render(
      <WorkoutSummaryPanel
        summary={summary}
        adherence={buildWorkoutAdherence(TEMPLATE, sets)}
        comparison={compareToPrevious(summary, previous)}
        personalBests={[]}
        templateName="Chest Day 1"
        exerciseLabels={LABELS}
      />
    )
    expect(screen.getByTestId('workout-comparison')).toBeInTheDocument()
    expect(screen.getByTestId('workout-delta-barbell-bench-press')).toHaveTextContent(
      /top set \+30 lb/
    )
  })

  it('flags a record set during the session', () => {
    const sets = [set({ id: 's1', reps: 5, weight_lbs: 225 })]
    const summary = buildWorkoutSummary(WORKOUT, sets, CATALOG)
    render(
      <WorkoutSummaryPanel
        summary={summary}
        adherence={null}
        comparison={null}
        personalBests={findPersonalBests(
          summary,
          [set({ id: 'old', logged_at: '2026-07-01T18:00:00Z', reps: 5, weight_lbs: 185 })],
          CATALOG
        )}
        templateName={null}
        exerciseLabels={LABELS}
      />
    )
    expect(screen.getByTestId('workout-pb-barbell-bench-press')).toHaveTextContent(/past 185 lb/i)
  })
})
