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
 * Every chip href carries `year` since #416 — absent means "newest year", the
 * default, so omitting it would snap an all-years view back to the newest one
 * the moment any other chip was clicked.
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
      '/training-facility/weight-room/workouts?template=t1&year=all&preview=demo'
    )
    expect(screen.getByTestId('workout-filter-all')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?year=all&preview=demo'
    )
  })

  it('leaves chip hrefs clean outside preview mode', () => {
    render(
      <WorkoutHistoryList entries={[]} filters={FILTERS} selectedTemplateId={null} hasAnyWorkouts />
    )
    expect(screen.getByTestId('workout-filter-all')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?year=all'
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
        hasImported
      />
    )
    // Switching template must preserve the source filter...
    expect(screen.getByTestId('workout-filter-t1')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&source=imported&year=all'
    )
    // ...and switching source must preserve the template.
    expect(screen.getByTestId('workout-source-recorded')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&source=recorded&year=all'
    )
    expect(screen.getByTestId('workout-source-all')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&year=all'
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
        hasImported
      />
    )
    expect(screen.getByTestId('workout-source-all')).toHaveTextContent('509')
    expect(screen.getByTestId('workout-source-imported')).toHaveTextContent('507')
    expect(screen.getByTestId('workout-source-recorded')).toHaveTextContent('2')
  })

  it('drops a source chip that matches nothing under the current filters (#445)', () => {
    // The counts are faceted by the selected year, so a year with no recorded
    // sessions gets no Recorded chip — rather than one advertising 0 that, when
    // clicked, falls back to a year that has some.
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        recordedCount={0}
        importedCount={22}
        hasImported
      />
    )
    expect(screen.queryByTestId('workout-source-recorded')).toBeNull()
    expect(screen.getByTestId('workout-source-imported')).toHaveTextContent('22')
  })

  it('keeps the selected source chip even at zero, so the filter is undoable', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        selectedSource="recorded"
        recordedCount={0}
        importedCount={22}
        hasImported
      />
    )
    expect(screen.getByTestId('workout-source-recorded')).toHaveTextContent('0')
    expect(screen.getByTestId('workout-source-all')).toBeInTheDocument()
  })

  it('hides the rail entirely when the log has nothing imported', () => {
    // The distinction doesn't apply to this log, so it shouldn't grow a filter.
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        recordedCount={9}
        importedCount={0}
      />
    )
    expect(screen.queryByTestId('workout-source-filter')).toBeNull()
  })
})

describe('WorkoutHistoryList — year rail and pagination (#416)', () => {
  const YEARS = [
    { year: 2026, count: 22 },
    { year: 2024, count: 65 },
    { year: 2022, count: 152 },
  ]

  it('renders a chip per year plus All years, with counts', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        years={YEARS}
        selectedYear={2026}
      />
    )
    expect(screen.getByTestId('workout-year-2026')).toHaveTextContent('22')
    expect(screen.getByTestId('workout-year-2022')).toHaveTextContent('152')
    // Total across every year, so All is honest about what it costs.
    expect(screen.getByTestId('workout-year-all')).toHaveTextContent('239')
    expect(screen.getByTestId('workout-year-2026')).toHaveAttribute('aria-current', 'page')
  })

  it('hides the rail when there is only one year to choose from', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        years={[{ year: 2026, count: 22 }]}
        selectedYear={2026}
      />
    )
    expect(screen.queryByTestId('workout-year-filter')).toBeNull()
  })

  it('keeps the other filters when switching year', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={FILTERS}
        selectedTemplateId="t1"
        hasAnyWorkouts
        years={YEARS}
        selectedYear={2026}
        selectedSource="imported"
        importedCount={5}
      />
    )
    expect(screen.getByTestId('workout-year-2022')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&source=imported&year=2022'
    )
    expect(screen.getByTestId('workout-year-all')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&source=imported&year=all'
    )
  })

  it('shows no pagination when everything fits on one page', () => {
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        page={1}
        totalPages={1}
      />
    )
    expect(screen.queryByTestId('workout-pagination')).toBeNull()
  })

  it('paginates with real, shareable URLs that preserve the filters', () => {
    const entries = buildWorkoutHistory([WORKOUT], SETS, [TEMPLATE])
    render(
      <WorkoutHistoryList
        entries={entries}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        years={YEARS}
        selectedYear={2022}
        page={2}
        totalPages={4}
        totalEntries={152}
      />
    )
    expect(screen.getByTestId('workout-page-prev')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?year=2022'
    )
    expect(screen.getByTestId('workout-page-next')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?year=2022&page=3'
    )
    expect(screen.getByTestId('workout-pagination')).toHaveTextContent('2 / 4')
  })

  it('omits the prev link on the first page and next on the last', () => {
    const entries = buildWorkoutHistory([WORKOUT], SETS, [TEMPLATE])
    const first = render(
      <WorkoutHistoryList
        entries={entries}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        page={1}
        totalPages={2}
        totalEntries={60}
      />
    )
    expect(first.queryByTestId('workout-page-prev')).toBeNull()
    expect(first.getByTestId('workout-page-next')).toBeInTheDocument()
    first.unmount()

    const last = render(
      <WorkoutHistoryList
        entries={entries}
        filters={[]}
        selectedTemplateId={null}
        hasAnyWorkouts
        page={2}
        totalPages={2}
        totalEntries={60}
      />
    )
    expect(last.getByTestId('workout-page-prev')).toBeInTheDocument()
    expect(last.queryByTestId('workout-page-next')).toBeNull()
  })

  it('resets to page 1 when a filter changes', () => {
    // Page 4 of one filter set has nothing to do with page 4 of another.
    render(
      <WorkoutHistoryList
        entries={[]}
        filters={FILTERS}
        selectedTemplateId={null}
        hasAnyWorkouts
        years={YEARS}
        selectedYear={2022}
        page={4}
        totalPages={4}
      />
    )
    expect(screen.getByTestId('workout-year-2024')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?year=2024'
    )
    expect(screen.getByTestId('workout-filter-t1')).toHaveAttribute(
      'href',
      '/training-facility/weight-room/workouts?template=t1&year=2022'
    )
  })
})
