import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import type { TodayBoardRow } from '@/lib/training-facility/today-board'

import { TodayProgressPanel } from './TodayProgressPanel'

const PUSHUPS: TodayBoardRow = {
  goal: {
    exercise: 'pushups',
    display_name: 'Pushups',
    daily_target: 100,
    color: '#EA580C',
    kind: 'permanent',
  },
  label: 'Pushups',
  total: 25,
  streak: 1,
}

const SL_RDL: TodayBoardRow = {
  goal: {
    exercise: 'single-leg-romanian-deadlift',
    daily_target: 60,
    color: '#16A34A',
    kind: 'focus',
  },
  label: 'Single Leg Romanian Deadlift',
  total: 0,
  streak: 0,
}

describe('TodayProgressPanel', () => {
  it('states every goal on the board with its count', () => {
    render(<TodayProgressPanel board={[PUSHUPS, SL_RDL]} />)
    expect(screen.getByTestId('today-row-pushups')).toHaveTextContent('Pushups')
    expect(screen.getByTestId('today-row-pushups')).toHaveTextContent('25 / 100')
    expect(screen.getByTestId(`today-row-${SL_RDL.goal.exercise}`)).toHaveTextContent(
      'Single Leg Romanian Deadlift'
    )
  })

  it('leaves the count out of the rings, where it would not fit, and keeps the label', () => {
    render(<TodayProgressPanel board={[PUSHUPS]} />)
    const rings = screen.getByTestId('activity-rings')
    expect(rings).not.toHaveTextContent('25')
    expect(within(rings).getByRole('img')).toHaveAccessibleName(/Pushups 25 of 100/)
  })

  it('announces a running streak and shows none when there is no streak', () => {
    render(<TodayProgressPanel board={[PUSHUPS, SL_RDL]} />)
    expect(screen.getByTestId('today-row-pushups')).toHaveTextContent('1d streak')
    expect(screen.getByTestId(`today-row-${SL_RDL.goal.exercise}`)).not.toHaveTextContent('streak')
  })

  it('says so when no goal is on the board', () => {
    render(<TodayProgressPanel board={[]} />)
    expect(screen.getByText(/no goals on today/i)).toBeInTheDocument()
    expect(screen.queryByTestId('activity-rings')).not.toBeInTheDocument()
  })
})
