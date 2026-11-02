import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import type { ExerciseGoal, MonthlyFocus, WeightRoomData } from '@/types/weight-room'

import { TodayProgressPanel } from './TodayProgressPanel'

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  display_name: 'Pushups',
  daily_target: 100,
  color: '#EA580C',
  kind: 'permanent',
}

const SL_RDL: ExerciseGoal = {
  exercise: 'single-leg-romanian-deadlift',
  display_name: 'Single Leg Romanian Deadlift',
  daily_target: 60,
  color: '#16A34A',
  kind: 'focus',
}

const SEPTEMBER_FOCUS: MonthlyFocus = {
  id: 'focus-1',
  exercise: SL_RDL.exercise,
  daily_target: 60,
  target_kind: 'reps',
  color: SL_RDL.color,
  category: 'lower',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
}

const DATA: WeightRoomData = {
  imported_at: '',
  goals: [PUSHUPS, SL_RDL],
  monthly_focus: [SEPTEMBER_FOCUS],
  sets: [
    { id: '1', exercise: 'pushups', reps: 25, logged_at: '2026-09-15T19:00:00.000Z' },
    { id: '2', exercise: 'pushups', reps: 100, logged_at: '2026-09-14T19:00:00.000Z' },
  ],
}

describe('TodayProgressPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-15T20:00:00.000Z') })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('states every goal on the board with its count', () => {
    render(<TodayProgressPanel data={DATA} />)
    const pushups = within(screen.getByTestId('today-row-pushups'))
    expect(pushups.getByText('Pushups')).toBeInTheDocument()
    expect(screen.getByTestId('today-row-pushups')).toHaveTextContent('25 / 100')
    expect(
      within(screen.getByTestId(`today-row-${SL_RDL.exercise}`)).getByText(
        'Single Leg Romanian Deadlift'
      )
    ).toBeInTheDocument()
  })

  it('leaves the count out of the rings, where it would not fit, and keeps the label', () => {
    render(<TodayProgressPanel data={DATA} />)
    const rings = screen.getByTestId('activity-rings')
    expect(rings).not.toHaveTextContent('25')
    expect(within(rings).getByRole('img')).toHaveAccessibleName(/Pushups 25 of 100/)
  })

  it('announces a running streak', () => {
    render(<TodayProgressPanel data={DATA} />)
    expect(screen.getByTestId('today-row-pushups')).toHaveTextContent('1d streak')
  })

  it('leaves out a focus goal outside its window', () => {
    vi.setSystemTime(new Date('2026-10-01T19:00:00.000Z'))
    render(<TodayProgressPanel data={DATA} />)
    expect(screen.getByTestId('today-row-pushups')).toBeInTheDocument()
    expect(screen.queryByTestId(`today-row-${SL_RDL.exercise}`)).not.toBeInTheDocument()
  })

  it('renders nothing when there is no data', () => {
    const { container } = render(<TodayProgressPanel data={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
