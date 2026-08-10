/**
 * Tests for the template composition panel (#446).
 *
 * This panel replaced a prescribed-vs-actual adherence score, which no session
 * in the log can support — none carries a frozen prescription, so the only
 * thing to grade against is today's template. The cases below pin the two
 * claims it makes instead: a movement that ran is listed even after the
 * template drops it, and one the template prescribes but never ran is named as
 * such rather than silently absent.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { WorkoutTemplate } from '@/types/weight-room'

import { buildExerciseLabels } from '@/lib/training-facility/exercise-labels'
import type { TemplateHistory, TemplateMovement } from '@/lib/training-facility/template-history'

import { TemplateCompositionPanel } from './TemplateCompositionPanel'

const TEMPLATE: WorkoutTemplate = {
  id: 't-chest',
  name: 'Chest Day 1',
  position: 0,
  slots: [],
}

function movement(exercise: string, prescribed: boolean, runs = 5): TemplateMovement {
  return { exercise, runs, sets: runs * 3, reps: runs * 24, tonnage: runs * 1000, prescribed }
}

function history(overrides: Partial<TemplateHistory> = {}): TemplateHistory {
  return {
    template: TEMPLATE,
    runs: Array.from({ length: 8 }, (_, i) => ({
      dayKey: `2024-01-0${i + 1}`,
      date: new Date(`2024-01-0${i + 1}T20:00:00Z`),
      workoutId: `w${i}`,
      tonnage: 1000,
      totalSets: 10,
      totalReps: 80,
      durationMinutes: 45,
    })),
    durations: [],
    movements: [],
    neverRun: [],
    firstDayKey: '2024-01-01',
    lastDayKey: '2024-01-08',
    ...overrides,
  }
}

const LABELS = buildExerciseLabels([
  { slug: 'barbell-bench-press', display_name: 'Barbell Bench Press' },
  { slug: 'barbell-overhead-press', display_name: 'Barbell Overhead Press' },
  { slug: 'sled-push', display_name: 'Sled Push' },
])

describe('TemplateCompositionPanel', () => {
  it('lists a movement the template no longer prescribes, and marks it', () => {
    render(
      <TemplateCompositionPanel
        history={history({
          movements: [
            movement('barbell-bench-press', true),
            movement('barbell-overhead-press', false),
          ],
        })}
        exerciseLabels={LABELS}
      />
    )
    expect(screen.getByText('Barbell Overhead Press')).toBeInTheDocument()
    expect(
      screen.getByTestId('template-movement-retired-barbell-overhead-press')
    ).toBeInTheDocument()
    // The still-prescribed one carries no badge.
    expect(screen.queryByTestId('template-movement-retired-barbell-bench-press')).toBeNull()
  })

  it('names a prescribed movement that has never run', () => {
    render(
      <TemplateCompositionPanel
        history={history({
          movements: [movement('barbell-bench-press', true)],
          neverRun: ['sled-push'],
        })}
        exerciseLabels={LABELS}
      />
    )
    expect(screen.getByTestId('template-never-run')).toHaveTextContent('Sled Push')
  })

  it('omits the never-run note when everything prescribed has run', () => {
    render(
      <TemplateCompositionPanel
        history={history({ movements: [movement('barbell-bench-press', true)] })}
        exerciseLabels={LABELS}
      />
    )
    expect(screen.queryByTestId('template-never-run')).toBeNull()
  })

  it('reports each movement against the number of runs', () => {
    render(
      <TemplateCompositionPanel
        history={history({ movements: [movement('barbell-bench-press', true, 6)] })}
        exerciseLabels={LABELS}
      />
    )
    expect(screen.getByTestId('template-movement-barbell-bench-press')).toHaveTextContent(
      '6 of 8 runs'
    )
  })

  it('links a movement to its own trend when a href builder is supplied', () => {
    render(
      <TemplateCompositionPanel
        history={history({ movements: [movement('barbell-bench-press', true)] })}
        exerciseLabels={LABELS}
        exerciseHref={slug => `/exercises/${slug}`}
      />
    )
    expect(screen.getByRole('link', { name: 'Barbell Bench Press' })).toHaveAttribute(
      'href',
      '/exercises/barbell-bench-press'
    )
  })

  it('says so plainly when nothing has been logged', () => {
    render(<TemplateCompositionPanel history={history()} exerciseLabels={LABELS} />)
    expect(screen.getByTestId('template-composition')).toHaveTextContent(
      'No sets have been logged under this workout yet.'
    )
  })
})
