import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import {
  ExerciseFilterChips,
  type FilterableExercise,
} from './ExerciseFilterChips'

/**
 * Tests for the History view's exercise filter chips (#367).
 *
 * A Server Component with no client state — the page resolves the selection
 * from `searchParams` and passes it in — so these assert the *hrefs*, which
 * are the entire interaction surface. No router mock is needed.
 */

const EXERCISES: FilterableExercise[] = [
  { exercise: 'pushups', color: '#EA580C', isFocus: false },
  { exercise: 'pullups', color: '#0EA5A1', isFocus: false },
  { exercise: 'shrugs', color: '#C9A268', isFocus: true },
]

const PATH = '/training-facility/weight-room/history'

function renderChips(
  selected: string[] = EXERCISES.map((e) => e.exercise),
  carryParams?: Record<string, string>,
) {
  return render(
    <ExerciseFilterChips
      exercises={EXERCISES}
      selected={selected}
      pathname={PATH}
      carryParams={carryParams}
    />,
  )
}

describe('ExerciseFilterChips', () => {
  it('renders one chip per exercise', () => {
    const { getByTestId } = renderChips()
    for (const { exercise } of EXERCISES) {
      expect(getByTestId(`exercise-chip-${exercise}`)).toBeInTheDocument()
    }
  })

  it('marks focus exercises with a GTG hint', () => {
    const { getByTestId } = renderChips()
    expect(getByTestId('exercise-chip-shrugs')).toHaveTextContent('GTG')
    expect(getByTestId('exercise-chip-pushups')).not.toHaveTextContent('GTG')
  })

  it('flags selected state for styling and tests', () => {
    const { getByTestId } = renderChips(['pushups'])
    expect(getByTestId('exercise-chip-pushups')).toHaveAttribute('data-selected', 'true')
    expect(getByTestId('exercise-chip-pullups')).toHaveAttribute('data-selected', 'false')
  })

  it('spells the toggle action out for assistive tech', () => {
    // The chip is a link, so pressed-ness has to live in the label rather
    // than aria-pressed (which is button-only).
    const { getByTestId } = renderChips(['pushups'])
    expect(getByTestId('exercise-chip-pushups')).toHaveAttribute('aria-label', 'Hide pushups')
    expect(getByTestId('exercise-chip-pullups')).toHaveAttribute('aria-label', 'Show pullups')
  })

  it('links a selected chip to the URL without it', () => {
    const { getByTestId } = renderChips()
    expect(getByTestId('exercise-chip-pullups')).toHaveAttribute(
      'href',
      `${PATH}?exercises=pushups%2Cshrugs`,
    )
  })

  it('links an unselected chip to the URL with it added, in render order', () => {
    // Adding shrugs to a pushups-only selection keeps it a partial set, and
    // the encoded order follows `exercises` rather than click order.
    const { getByTestId } = renderChips(['pushups'])
    expect(getByTestId('exercise-chip-shrugs')).toHaveAttribute(
      'href',
      `${PATH}?exercises=pushups%2Cshrugs`,
    )
  })

  it('drops the param entirely on the last chip that completes the set', () => {
    const { getByTestId } = renderChips(['pushups', 'pullups'])
    expect(getByTestId('exercise-chip-shrugs')).toHaveAttribute('href', PATH)
  })

  it('links deselecting the final exercise to an explicit empty selection', () => {
    // `?exercises=` rather than a bare path, so "nothing" survives the round
    // trip instead of parsing back as "everything".
    const { getByTestId } = renderChips(['pushups'])
    expect(getByTestId('exercise-chip-pushups')).toHaveAttribute('href', `${PATH}?exercises=`)
  })

  it('offers a reset link only when something is filtered out', () => {
    const { queryByTestId } = renderChips()
    expect(queryByTestId('exercise-chip-reset')).toBeNull()

    const { getByTestId } = renderChips(['pushups'])
    expect(getByTestId('exercise-chip-reset')).toHaveAttribute('href', PATH)
  })

  it('carries an unrelated preview param through every chip href', () => {
    const { getByTestId } = renderChips(['pushups'], { preview: 'demo' })
    expect(getByTestId('exercise-chip-pullups').getAttribute('href')).toContain('preview=demo')
    expect(getByTestId('exercise-chip-reset').getAttribute('href')).toContain('preview=demo')
  })

  it('labels the chip group for assistive tech', () => {
    const { getByRole } = renderChips()
    expect(getByRole('navigation', { name: /show/i })).toBeInTheDocument()
  })
})

describe('ExerciseFilterChips — catalog labels (#384)', () => {
  // Two movements, so toggling one produces a real filter param — with a
  // single movement "selected" collapses to "all", which needs no param.
  const LABELLED = [
    { exercise: 'barbell-bench-press', displayName: 'Barbell Bench Press', color: '#EA580C', isFocus: false },
    { exercise: 'barbell-row', displayName: 'Barbell Row', color: '#0EA5A1', isFocus: false },
  ]

  it('shows the display name but keeps the slug as the URL token', () => {
    const { getByTestId, getByText } = render(
      <ExerciseFilterChips exercises={LABELLED} selected={[]} pathname={PATH} />,
    )
    expect(getByText('Barbell Bench Press')).toBeInTheDocument()
    // The href must stay slug-based or a shared filtered link breaks.
    const chip = getByTestId('exercise-chip-barbell-bench-press')
    expect(chip.getAttribute('href')).toContain('barbell-bench-press')
    expect(chip.getAttribute('href')).not.toContain('Barbell')
  })

  it('names the toggle by the label for screen readers', () => {
    const { getByLabelText } = render(
      <ExerciseFilterChips exercises={LABELLED} selected={[]} pathname={PATH} />,
    )
    expect(getByLabelText('Show Barbell Bench Press')).toBeInTheDocument()
  })
})

