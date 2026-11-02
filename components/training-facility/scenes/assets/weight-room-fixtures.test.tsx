import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import type { ExerciseGoal, MonthlyFocus, WeightRoomData } from '@/types/weight-room'

import { WallActivityRings } from './weight-room-fixtures'

/**
 * Regression coverage for the Weight Room scene's wall fixture. The
 * original fixed geometry (`OUTER_RADIUS - i * (STROKE + GAP)` with a
 * hard `radius < STROKE / 2` cutoff) plus a `rings.slice(0, 2)` tally cap
 * silently dropped every goal past the third: a real 4-goal wall
 * (pullups, pushups, a shrugs focus lane, squats) rendered only three
 * rings and labeled just two. These tests pin the auto-fit so every
 * configured goal earns a ring *and* a label.
 *
 * `WallActivityRings` returns an SVG `<g>`, so it renders inside an
 * `<svg>` the way it lives inside the scene viewBox.
 */
function makeGoal(exercise: string, color: string): ExerciseGoal {
  return { exercise, daily_target: 100, color, kind: 'permanent' }
}

const FOUR_GOALS: ExerciseGoal[] = [
  makeGoal('pullups', '#0EA5A1'),
  makeGoal('pushups', '#EA580C'),
  makeGoal('shrugs', '#C9A268'),
  makeGoal('squats', '#2563EB'),
]

function makeData(goals: ExerciseGoal[]): WeightRoomData {
  return { imported_at: '', sets: [], goals, monthly_focus: [] }
}

function renderInScene(data: WeightRoomData | null) {
  return render(
    <svg viewBox="0 0 1600 900" data-testid="scene">
      <WallActivityRings data={data} />
    </svg>
  )
}

describe('WallActivityRings', () => {
  it('renders a ring for every configured goal, not just the first three', () => {
    const { getByTestId } = renderInScene(makeData(FOUR_GOALS))
    for (const goal of FOUR_GOALS) {
      expect(getByTestId(`wall-ring-${goal.exercise}`)).toBeInTheDocument()
    }
  })

  it('keeps the fourth ring (a permanent goal behind a focus lane) visible', () => {
    // The squats ring is the one the fixed geometry used to drop; assert
    // it renders with its own color so a regression can't hide it again.
    const { getByTestId } = renderInScene(makeData(FOUR_GOALS))
    const squats = getByTestId('wall-ring-squats')
    const arc = squats.querySelectorAll('circle')[1]
    expect(arc.getAttribute('stroke')).toBe('#2563EB')
  })

  it('labels every ring instead of capping the tallies at two', () => {
    const { getByTestId } = renderInScene(makeData(FOUR_GOALS))
    for (const goal of FOUR_GOALS) {
      expect(getByTestId(`wall-tally-${goal.exercise}`)).toBeInTheDocument()
    }
  })

  describe('focus windows', () => {
    const FOCUS_GOAL: ExerciseGoal = { ...makeGoal('shrugs', '#C9A268'), kind: 'focus' }
    const OCTOBER_FOCUS: MonthlyFocus = {
      id: 'focus-1',
      exercise: 'shrugs',
      daily_target: 100,
      target_kind: 'reps',
      color: '#C9A268',
      category: 'upper',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
    }
    const data: WeightRoomData = {
      ...makeData([makeGoal('pushups', '#EA580C'), FOCUS_GOAL]),
      monthly_focus: [OCTOBER_FOCUS],
    }

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows a focus ring while its window covers today', () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-31T19:00:00.000Z') })
      const { getByTestId } = renderInScene(data)
      expect(getByTestId('wall-ring-shrugs')).toBeInTheDocument()
      expect(getByTestId('wall-ring-pushups')).toBeInTheDocument()
    })

    it('drops a focus ring the day after its window ends', () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T19:00:00.000Z') })
      const { getByTestId, queryByTestId } = renderInScene(data)
      expect(queryByTestId('wall-ring-shrugs')).not.toBeInTheDocument()
      expect(queryByTestId('wall-tally-shrugs')).not.toBeInTheDocument()
      expect(getByTestId('wall-ring-pushups')).toBeInTheDocument()
    })
  })

  it('falls back to ghost rings and a "no goals yet" note when no goals exist', () => {
    const { getByText, queryByTestId } = renderInScene(null)
    expect(getByText(/no goals yet/i)).toBeInTheDocument()
    expect(queryByTestId('wall-ring-pushups')).not.toBeInTheDocument()
  })
})
