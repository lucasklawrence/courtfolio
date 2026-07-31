import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { ExerciseFilter, type FilterableExercise } from './ExerciseFilter'

/**
 * Tests for the History view's exercise filter (#367). `next/navigation` is
 * mocked so the URL contract can be asserted without a router: the component's
 * whole job is to read a param, render the matching subset, and write the
 * param back.
 */

const replaceMock = vi.fn()
let currentParams: URLSearchParams

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/training-facility/weight-room/history',
  useSearchParams: () => currentParams,
}))

const EXERCISES: FilterableExercise[] = [
  { exercise: 'pushups', color: '#EA580C', isFocus: false },
  { exercise: 'pullups', color: '#0EA5A1', isFocus: false },
  { exercise: 'shrugs', color: '#C9A268', isFocus: true },
]

/** Render with sections/stats for every exercise, and an unfiltered slot. */
function renderFilter(params = '') {
  currentParams = new URLSearchParams(params)
  return render(
    <ExerciseFilter
      exercises={EXERCISES}
      sections={EXERCISES.map(({ exercise }) => ({
        exercise,
        node: <div data-testid={`section-${exercise}`}>{exercise} section</div>,
      }))}
      statsSections={EXERCISES.map(({ exercise }) => ({
        exercise,
        node: <div data-testid={`stat-${exercise}`}>{exercise} stat</div>,
      }))}
      statsHeading={<h2>Stats</h2>}
      afterSections={<div data-testid="relative-strength">relative strength</div>}
    />,
  )
}

beforeEach(() => {
  replaceMock.mockReset()
})

describe('ExerciseFilter', () => {
  it('shows every exercise when the param is absent', () => {
    const { getByTestId } = renderFilter()
    for (const { exercise } of EXERCISES) {
      expect(getByTestId(`section-${exercise}`)).toBeInTheDocument()
      expect(getByTestId(`stat-${exercise}`)).toBeInTheDocument()
    }
  })

  it('renders every chip as pressed by default', () => {
    const { getByTestId } = renderFilter()
    for (const { exercise } of EXERCISES) {
      expect(getByTestId(`exercise-chip-${exercise}`)).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('marks focus exercises with a GTG hint on the chip', () => {
    const { getByTestId } = renderFilter()
    expect(getByTestId('exercise-chip-shrugs')).toHaveTextContent('GTG')
    expect(getByTestId('exercise-chip-pushups')).not.toHaveTextContent('GTG')
  })

  it('renders only the selected subset', () => {
    const { getByTestId, queryByTestId } = renderFilter('exercises=pushups')
    expect(getByTestId('section-pushups')).toBeInTheDocument()
    expect(queryByTestId('section-pullups')).toBeNull()
    expect(queryByTestId('stat-pullups')).toBeNull()
    expect(getByTestId('exercise-chip-pullups')).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters the stats grid alongside the heatmaps', () => {
    const { getByTestId, queryByTestId } = renderFilter('exercises=shrugs')
    // shrugs is a focus: it has a stats card but no per-exercise heatmap
    // section, so only the stat should appear.
    expect(getByTestId('stat-shrugs')).toBeInTheDocument()
    expect(queryByTestId('stat-pushups')).toBeNull()
  })

  it('drops the param entirely when re-selecting everything', () => {
    const { getByTestId } = renderFilter('exercises=pushups')
    fireEvent.click(getByTestId('exercise-chip-reset'))
    expect(replaceMock).toHaveBeenCalledWith('/training-facility/weight-room/history', {
      scroll: false,
    })
  })

  it('writes the remaining selection when a chip is switched off', () => {
    const { getByTestId } = renderFilter()
    fireEvent.click(getByTestId('exercise-chip-pullups'))
    expect(replaceMock).toHaveBeenCalledWith(
      '/training-facility/weight-room/history?exercises=pushups%2Cshrugs',
      { scroll: false },
    )
  })

  it('preserves unrelated query params when toggling', () => {
    const { getByTestId } = renderFilter('preview=demo')
    fireEvent.click(getByTestId('exercise-chip-pullups'))
    const [url] = replaceMock.mock.calls[0]
    expect(url).toContain('preview=demo')
    expect(url).toContain('exercises=')
  })

  it('shows an empty state when nothing is selected', () => {
    const { getByTestId, queryByTestId } = renderFilter('exercises=')
    expect(getByTestId('exercise-filter-empty')).toBeInTheDocument()
    expect(queryByTestId('section-pushups')).toBeNull()
  })

  it('keeps the unfiltered slot visible even with nothing selected', () => {
    // Relative strength is a featured cross-cutting chart, not per-exercise
    // detail — deselecting every chip must not take it down.
    const { getByTestId } = renderFilter('exercises=')
    expect(getByTestId('relative-strength')).toBeInTheDocument()
  })

  it('hides the reset affordance when everything is already selected', () => {
    const { queryByTestId } = renderFilter()
    expect(queryByTestId('exercise-chip-reset')).toBeNull()
  })

  it('exposes the chips as a labelled group for assistive tech', () => {
    const { getByRole } = renderFilter()
    expect(getByRole('group', { name: /show/i })).toBeInTheDocument()
  })
})
