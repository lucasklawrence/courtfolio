import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import type { ExerciseGoal, WeightRoomData } from '@/types/weight-room'

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
    </svg>,
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

  it('falls back to ghost rings and a "no goals yet" note when no goals exist', () => {
    const { getByText, queryByTestId } = renderInScene(null)
    expect(getByText(/no goals yet/i)).toBeInTheDocument()
    expect(queryByTestId('wall-ring-pushups')).not.toBeInTheDocument()
  })
})
