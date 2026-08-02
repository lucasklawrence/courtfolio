import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { buildWorkoutHistory } from '@/lib/training-facility/workout-stats'
import type { StrengthSet, WeightRoomWorkout, WorkoutTemplate } from '@/types/weight-room'

import {
  WorkoutHistoryList,
  type TemplateFilterOption,
  type WorkoutHistoryListProps,
} from './WorkoutHistoryList'

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
    // Copy is filter-agnostic since #413 added the provenance axis — it can no
    // longer name templates specifically, because either filter can empty the list.
    expect(screen.getByTestId('workout-history-empty')).toHaveTextContent(
      /No sessions match that filter/i
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

  it('keeps preview mode alive through the filter chips', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={FILTERS}
        selectedTemplateId={null}
        hasAnyWorkouts
        isPreviewMode
      />
    )
    // Dropping the param navigates back to an empty real read, which ends the
    // demo tour one click in.
    expect(screen.getByTestId('workout-filter-t1')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&preview=demo'
    )
    expect(screen.getByTestId('workout-filter-all')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?preview=demo'
    )
  })

  it('leaves chip hrefs clean outside preview mode', () => {
    render(
      <WorkoutHistoryList entries={[]} filters={FILTERS} selectedTemplateId={null} hasAnyWorkouts />
    )
    expect(screen.getByTestId('workout-filter-all')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts'
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

describe('WorkoutHistoryList — imported sessions (#413)', () => {
  const IMPORTED: WeightRoomWorkout = {
    id: 'wh1',
    started_at: '2019-03-04T18:00:00Z',
    ended_at: '2019-03-04T18:47:00Z',
    source: 'apple_health',
    avg_hr: 112,
    max_hr: 148,
  }

  function renderImported(overrides: Partial<WorkoutHistoryListProps> = {}) {
    const entries = buildWorkoutHistory([IMPORTED], [], [], [])
    render(
      <WorkoutHistoryList
        entries={entries}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        importedCount={1}
        recordedCount={0}
        {...overrides}
      />
    )
  }

  it('badges an imported row so it is never mistaken for a recorded one', () => {
    renderImported()
    expect(screen.getByTestId('workout-imported-badge')).toHaveTextContent('Apple Health')
  })

  it('shows HR instead of zeroed sets and reps', () => {
    renderImported()
    const row = screen.getByTestId('workout-row-wh1')
    // Three zeros would read as "you did nothing", which is the opposite of
    // what the record says happened.
    expect(row).not.toHaveTextContent(/0 sets/)
    expect(row).toHaveTextContent(/112\s*avg bpm/)
    expect(row).toHaveTextContent(/47\s*min/)
  })

  it('titles it by what it is, not as a freestyle session', () => {
    // "Freestyle session" claims an intent — that a plan was declined — which
    // nothing about an import supports.
    expect(buildWorkoutHistory([IMPORTED], [], [], [])[0].workout.source).toBe('apple_health')
    renderImported()
    expect(screen.getByTestId('workout-row-wh1')).toHaveTextContent('Strength training')
  })

  it('offers the provenance rail only once something is imported', () => {
    renderImported({ importedCount: 0 })
    expect(screen.queryByTestId('workout-source-filter')).toBeNull()
  })

  it('keeps both filter axes in every chip href, so one never clears the other', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={FILTERS}
        selectedTemplateId="t1"
        hasAnyWorkouts
        selectedSource="imported"
        recordedCount={2}
        importedCount={507}
      />
    )
    // Switching template must preserve the source filter...
    expect(screen.getByTestId('workout-filter-t1')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&source=imported'
    )
    // ...and switching source must preserve the template.
    expect(screen.getByTestId('workout-source-recorded')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&source=recorded'
    )
    expect(screen.getByTestId('workout-source-all')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1'
    )
  })

  it('counts each population on its chip', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        recordedCount={2}
        importedCount={507}
      />
    )
    expect(screen.getByTestId('workout-source-all')).toHaveTextContent('509')
    expect(screen.getByTestId('workout-source-imported')).toHaveTextContent('507')
    expect(screen.getByTestId('workout-source-recorded')).toHaveTextContent('2')
  })
})
