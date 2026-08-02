import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { buildWorkoutHistory } from '@/lib/training-facility/workout-stats'
import type { StrengthSet, WeightRoomWorkout, WorkoutTemplate } from '@/types/weight-room'

import { WorkoutHistoryList, type TemplateFilterOption } from './WorkoutHistoryList'

/**
 * Rendering coverage for the workout history (#377).
 *
 * Chiefly the two states that read wrong if conflated — "you haven't recorded
 * anything yet" versus "this filter matched nothing" — and the preview link
 * suffix, without which a demo row clicks through to a 404.
 */

const TEMPLATE: WorkoutTemplate = {
  id: 't1',
  name: 'Chest Day 1',
  color: '#EA580C',
  position: 0,
  slots: [],
}

const WORKOUT: WeightRoomWorkout = {
  id: 'w1',
  started_at: '2026-08-01T18:00:00Z',
  ended_at: '2026-08-01T19:00:00Z',
  template_id: 't1',
}

const SETS: StrengthSet[] = [
  {
    id: 's1',
    logged_at: '2026-08-01T18:10:00Z',
    exercise: 'barbell-bench-press',
    reps: 8,
    weight_lbs: 155,
    workout_id: 'w1',
  },
]

const FILTERS: TemplateFilterOption[] = [
  { id: null, name: 'All', color: null, count: 1 },
  { id: 't1', name: 'Chest Day 1', color: '#EA580C', count: 1 },
]

describe('WorkoutHistoryList', () => {
  it('invites a first workout when nothing has ever been recorded', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts={false}
      />
    )
    expect(screen.getByTestId('workout-history-empty')).toHaveTextContent(
      /No workouts recorded yet/i
    )
  })

  it('distinguishes a filter that matched nothing from a fresh log', () => {
    render(
      <WorkoutHistoryList entries={[]} filters={FILTERS} selectedTemplateId="t1" hasAnyWorkouts />
    )
    expect(screen.getByTestId('workout-history-empty')).toHaveTextContent(
      /No sessions recorded for that template/i
    )
  })

  it('renders a row linking to the session summary', () => {
    const entries = buildWorkoutHistory([WORKOUT], SETS, [TEMPLATE])
    render(
      <WorkoutHistoryList
        entries={entries}
        filters={FILTERS}
        selectedTemplateId={null}
        hasAnyWorkouts
      />
    )
    const row = screen.getByTestId('workout-row-w1')
    expect(row).toHaveAttribute('href', '/training-facility/weight-room/workouts/w1')
    expect(row).toHaveTextContent('Chest Day 1')
    expect(row).toHaveTextContent('8')
  })

  it('carries the preview param through so a demo row does not 404', () => {
    const entries = buildWorkoutHistory([WORKOUT], SETS, [TEMPLATE])
    render(
      <WorkoutHistoryList
        entries={entries}
        filters={FILTERS}
        selectedTemplateId={null}
        hasAnyWorkouts
        isPreviewMode
      />
    )
    expect(screen.getByTestId('workout-row-w1')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts/w1?preview=demo'
    )
  })

  it('marks the active filter chip for assistive tech', () => {
    render(
      <WorkoutHistoryList entries={[]} filters={FILTERS} selectedTemplateId="t1" hasAnyWorkouts />
    )
    expect(screen.getByTestId('workout-filter-t1')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('workout-filter-all')).not.toHaveAttribute('aria-current')
  })

  it('hides the filter rail when only the All chip exists', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[{ id: null, name: 'All', color: null, count: 0 }]}
        selectedTemplateId={null}
        hasAnyWorkouts={false}
      />
    )
    expect(screen.queryByTestId('workout-template-filter')).toBeNull()
  })

  it('dates a late-evening session to its Pacific day, not the UTC one', () => {
    // 2026-07-31T22:00 Pacific is 2026-08-01T05:00Z. Formatted off the raw
    // instant on a UTC server this reads "Sat, Aug 1", contradicting the Friday
    // that `workoutDayKey` assigns the whole session to.
    const entries = buildWorkoutHistory(
      [{ id: 'w3', started_at: '2026-08-01T05:00:00Z' }],
      [],
      [],
      []
    )
    render(
      <WorkoutHistoryList entries={entries} filters={[]} selectedTemplateId={null} hasAnyWorkouts />
    )
    expect(screen.getByTestId('workout-row-w3')).toHaveTextContent('Fri, Jul 31')
  })

  it('labels a never-ended session rather than showing a blank duration', () => {
    const entries = buildWorkoutHistory(
      [{ id: 'w2', started_at: '2026-08-01T18:00:00Z' }],
      [],
      [],
      [],
      new Date('2026-08-04T18:00:00Z')
    )
    render(
      <WorkoutHistoryList entries={entries} filters={[]} selectedTemplateId={null} hasAnyWorkouts />
    )
    expect(screen.getByTestId('workout-row-w2')).toHaveTextContent(/never ended/i)
  })
})
