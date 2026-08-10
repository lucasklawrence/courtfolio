/**
 * Tests for the whole-workout charts (#446).
 *
 * Two things worth pinning: a single run can't be a trend and must say so
 * rather than render a collapsed axis, and the duration chart has to account
 * for the runs it leaves out — an `icloud_notes` session's window measures
 * note-taking, so silently dropping it would understate how often this workout
 * was actually timed.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { WorkoutTemplate } from '@/types/weight-room'

import type { TemplateHistory, TemplateRunPoint } from '@/lib/training-facility/template-history'

import { TemplateRunCharts } from './TemplateRunCharts'

const TEMPLATE: WorkoutTemplate = { id: 't', name: 'Chest Day 1', position: 0, slots: [] }

function run(day: number, minutes: number | null = 45): TemplateRunPoint {
  const dayKey = `2024-01-${String(day).padStart(2, '0')}`
  return {
    dayKey,
    date: new Date(`${dayKey}T20:00:00Z`),
    workoutId: `w${day}`,
    tonnage: 10_000 + day * 100,
    totalSets: 12,
    totalReps: 96,
    durationMinutes: minutes,
  }
}

function history(
  runs: TemplateRunPoint[],
  durations = runs,
  excluded: { noteTimedRuns?: number; untimedRuns?: number } = {}
): TemplateHistory {
  const missing = runs.length - durations.length
  return {
    template: TEMPLATE,
    runs,
    durations,
    // Default the whole shortfall to the note-timed cause, which is what the
    // real log looks like; a case that cares states both explicitly.
    noteTimedRuns: excluded.noteTimedRuns ?? missing - (excluded.untimedRuns ?? 0),
    untimedRuns: excluded.untimedRuns ?? 0,
    movements: [],
    neverRun: [],
    firstDayKey: runs[0]?.dayKey ?? '',
    lastDayKey: runs[runs.length - 1]?.dayKey ?? '',
  }
}

describe('TemplateRunCharts', () => {
  it('renders the trends once there are two runs', () => {
    render(<TemplateRunCharts history={history([run(1), run(8)])} />)
    expect(screen.getByTestId('template-run-charts')).toBeInTheDocument()
    expect(screen.queryByTestId('template-single-run-note')).toBeNull()
  })

  it('plots reps and sets on separate axes, not one shared scale', () => {
    // Reps run an order of magnitude above sets; overlaying them flattens the
    // set line into a smear along the baseline (#266).
    render(<TemplateRunCharts history={history([run(1), run(8)])} />)
    expect(screen.getByRole('img', { name: /reps per session/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /sets per session/i })).toBeInTheDocument()
  })

  it('explains a single run instead of drawing a collapsed axis', () => {
    render(<TemplateRunCharts history={history([run(1)])} />)
    expect(screen.getByTestId('template-single-run-note')).toHaveTextContent('Ran once so far')
    expect(screen.queryByTestId('template-run-charts')).toBeNull()
  })

  it('says so when the workout has never run', () => {
    render(<TemplateRunCharts history={history([])} />)
    expect(screen.getByTestId('template-single-run-note')).toHaveTextContent(
      'No sessions have run this workout yet.'
    )
  })

  it('accounts for runs left out of the duration series', () => {
    const runs = [run(1), run(8), run(15)]
    render(<TemplateRunCharts history={history(runs, [run(1), run(8)])} />)
    expect(screen.getByRole('img', { name: /duration per session/i })).toBeInTheDocument()
    expect(screen.getByTestId('template-run-charts')).toHaveTextContent('1 of 3 runs are left out')
  })

  it('names each reason a run is missing, not just the note-timed one', () => {
    // Two distinct causes reach the same subtraction. Blaming both on note
    // timestamps would be a plausible-sounding lie about the untimed run.
    const runs = [run(1), run(8), run(15), run(22)]
    render(
      <TemplateRunCharts
        history={history(runs, [run(1), run(8)], { noteTimedRuns: 1, untimedRuns: 1 })}
      />
    )
    const charts = screen.getByTestId('template-run-charts')
    expect(charts).toHaveTextContent('2 of 4 runs are left out')
    expect(charts).toHaveTextContent('when a note was written')
    expect(charts).toHaveTextContent('1 recorded no end time')
  })

  it('says only the untimed reason when no run is note-timed', () => {
    const runs = [run(1), run(8), run(15)]
    render(
      <TemplateRunCharts
        history={history(runs, [run(1), run(8)], { noteTimedRuns: 0, untimedRuns: 1 })}
      />
    )
    const charts = screen.getByTestId('template-run-charts')
    expect(charts).toHaveTextContent('1 recorded no end time')
    expect(charts).not.toHaveTextContent('when a note was written')
  })

  it('drops the duration chart when too few runs recorded a real one', () => {
    render(<TemplateRunCharts history={history([run(1), run(8)], [run(1)])} />)
    expect(screen.queryByRole('img', { name: /duration per session/i })).toBeNull()
    // The other two charts still render.
    expect(screen.getByRole('img', { name: /tonnage per session/i })).toBeInTheDocument()
  })
})
