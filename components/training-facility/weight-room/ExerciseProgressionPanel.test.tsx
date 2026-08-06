import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import {
  buildExerciseProgression,
  buildSetDetailCoverage,
  type ExerciseProgression,
} from '@/lib/training-facility/exercise-progression'
import type { StrengthSet, WeightRoomExercise, WeightRoomWorkout } from '@/types/weight-room'

import { ExerciseProgressionPanel, exerciseTrendHref } from './ExerciseProgressionPanel'

/**
 * Coverage for the per-exercise trend panel (#412).
 *
 * The assertions worth having are about *honesty*, not layout: that a loaded
 * movement with nothing but 20-rep sets gets no estimate line and an explanation
 * instead, that a bodyweight movement doesn't render a load panel at all, and
 * that the years of duration-only imports before the first set are stated rather
 * than left as a suspiciously short axis.
 */

const CATALOG: WeightRoomExercise[] = [
  {
    slug: 'barbell-bench-press',
    display_name: 'Barbell Bench Press',
    equipment: 'barbell',
    muscle_group: 'chest',
  },
  {
    slug: 'shrugs',
    display_name: 'Shrugs',
    equipment: 'dumbbell',
    muscle_group: 'back',
    load_multiplier: 2,
  },
  { slug: 'pullups', display_name: 'Pullups', equipment: 'bodyweight', muscle_group: 'back' },
]

const NO_COVERAGE = { sessionsBefore: 0, earliestSessionDayKey: null }

/** Sets across four training days, one per day. */
function daily(
  exercise: string,
  days: readonly { day: string; reps: number; weight?: number }[]
): StrengthSet[] {
  return days.map(({ day, reps, weight }, i) => ({
    id: `${exercise}-${i}`,
    logged_at: `${day}T19:00:00-07:00`,
    exercise,
    reps,
    ...(weight === undefined ? {} : { weight_lbs: weight }),
  }))
}

function progressionFor(sets: StrengthSet[], exercise: string): ExerciseProgression {
  const built = buildExerciseProgression(exercise, sets, CATALOG)
  if (built === null) throw new Error(`fixture produced no progression for ${exercise}`)
  return built
}

/** A loaded movement trained low-rep — the shape that earns an estimate line. */
const LOW_REP_BENCH = progressionFor(
  daily('barbell-bench-press', [
    { day: '2026-07-06', reps: 5, weight: 155 },
    { day: '2026-07-13', reps: 5, weight: 165 },
    { day: '2026-07-20', reps: 5, weight: 175 },
  ]),
  'barbell-bench-press'
)

/** A loaded movement trained entirely above the cutoff — every real one, today. */
const HIGH_REP_SHRUGS = progressionFor(
  daily('shrugs', [
    { day: '2026-07-06', reps: 25, weight: 50 },
    { day: '2026-07-13', reps: 25, weight: 55 },
    { day: '2026-07-20', reps: 20, weight: 60 },
  ]),
  'shrugs'
)

/** A bodyweight movement. */
const PULLUPS = progressionFor(
  daily('pullups', [
    { day: '2026-07-06', reps: 8 },
    { day: '2026-07-13', reps: 10 },
    { day: '2026-07-20', reps: 12 },
  ]),
  'pullups'
)

describe('ExerciseProgressionPanel', () => {
  it('draws the estimated-1RM overlay when low-rep sets support one', () => {
    const { container } = render(
      <ExerciseProgressionPanel
        progression={LOW_REP_BENCH}
        displayName="Barbell Bench Press"
        coverage={NO_COVERAGE}
      />
    )

    expect(container.querySelector('[data-testid="rough-line-overlay"]')).not.toBeNull()
    expect(screen.getByText(/Dashed: estimated 1RM/)).toBeInTheDocument()
    // 175 × (1 + 5/30) ≈ 204
    expect(screen.getByText('~204 lb')).toBeInTheDocument()
  })

  it('omits the estimate line and says why when every loaded set is high-rep', () => {
    const { container } = render(
      <ExerciseProgressionPanel
        progression={HIGH_REP_SHRUGS}
        displayName="Shrugs"
        coverage={NO_COVERAGE}
      />
    )

    expect(container.querySelector('[data-testid="rough-line-overlay"]')).toBeNull()
    expect(screen.getByTestId('exercise-estimate-note')).toHaveTextContent(
      /all 3 loaded sets ran above 12 reps/
    )
    expect(screen.queryByText('Best est. 1RM')).not.toBeInTheDocument()
  })

  it('renders no load panel for a bodyweight movement', () => {
    render(
      <ExerciseProgressionPanel
        progression={PULLUPS}
        displayName="Pullups"
        coverage={NO_COVERAGE}
      />
    )

    expect(screen.queryByRole('heading', { name: 'Top set' })).not.toBeInTheDocument()
    expect(screen.queryByText('Heaviest set')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Best set' })).toBeInTheDocument()
    expect(screen.getByText('Most reps')).toBeInTheDocument()
  })

  it('reports the heaviest set at the load actually moved, not per implement', () => {
    render(
      <ExerciseProgressionPanel
        progression={HIGH_REP_SHRUGS}
        displayName="Shrugs"
        coverage={NO_COVERAGE}
      />
    )

    // 60 per hand, two at a time.
    expect(
      within(screen.getByTestId('exercise-records')).getByText('20 × 120 lb')
    ).toBeInTheDocument()
  })

  it('states the imported sessions that predate the first recorded set', () => {
    const workouts: WeightRoomWorkout[] = [
      { id: 'w1', started_at: '2018-01-08T18:00:00Z', source: 'apple_health' },
      { id: 'w2', started_at: '2022-06-01T18:00:00Z', source: 'apple_health' },
    ]
    const coverage = buildSetDetailCoverage(PULLUPS.points[0].dayKey, workouts, [])

    render(
      <ExerciseProgressionPanel progression={PULLUPS} displayName="Pullups" coverage={coverage} />
    )

    const note = screen.getByTestId('exercise-coverage-note')
    expect(note).toHaveTextContent('Set-level detail for Pullups begins July 6, 2026')
    expect(note).toHaveTextContent('2 earlier sessions')
    expect(note).toHaveTextContent('January 2018')
  })

  it('leaves the caption at the start date when nothing predates it', () => {
    render(
      <ExerciseProgressionPanel
        progression={PULLUPS}
        displayName="Pullups"
        coverage={NO_COVERAGE}
      />
    )

    const note = screen.getByTestId('exercise-coverage-note')
    expect(note).toHaveTextContent('Set-level detail for Pullups begins July 6, 2026')
    expect(note).not.toHaveTextContent('earlier sessions')
  })

  it('drops both panels for a single training day rather than stacking empty plots', () => {
    const oneDay = progressionFor(
      daily('shrugs', [{ day: '2026-08-05', reps: 20, weight: 30 }]),
      'shrugs'
    )

    render(
      <ExerciseProgressionPanel progression={oneDay} displayName="Shrugs" coverage={NO_COVERAGE} />
    )

    expect(screen.queryByRole('heading', { name: 'Top set' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Best set' })).not.toBeInTheDocument()
    expect(screen.getByTestId('exercise-single-day-note')).toHaveTextContent('One training day')
    // The record and the day itself still carry the movement.
    expect(screen.getByTestId('exercise-records')).toBeInTheDocument()
    expect(screen.getByTestId('exercise-day-2026-08-05')).toBeInTheDocument()
  })

  it('lists recent training days newest first', () => {
    render(
      <ExerciseProgressionPanel
        progression={PULLUPS}
        displayName="Pullups"
        coverage={NO_COVERAGE}
      />
    )

    const rows = screen.getAllByTestId(/^exercise-day-/)
    expect(rows.map(row => row.getAttribute('data-testid'))).toEqual([
      'exercise-day-2026-07-20',
      'exercise-day-2026-07-13',
      'exercise-day-2026-07-06',
    ])
  })
})

describe('exerciseTrendHref', () => {
  it('builds a plain route by default', () => {
    expect(exerciseTrendHref('barbell-bench-press')).toBe(
      '/training-facility/weight-room/exercises/barbell-bench-press'
    )
  })

  it('carries the preview param so a demo tour does not dead-end', () => {
    expect(exerciseTrendHref('pullups', true)).toBe(
      '/training-facility/weight-room/exercises/pullups?preview=demo'
    )
  })
})
