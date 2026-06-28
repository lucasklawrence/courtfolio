import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { FocusAdherence, FocusLoadStats } from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'

import { MonthlyFocusCard } from './MonthlyFocusCard'

const FOCUS: MonthlyFocus = {
  id: 'f1',
  exercise: 'shrugs',
  daily_target: 100,
  target_kind: 'reps',
  color: '#C9A268',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

const ADHERENCE: FocusAdherence = {
  daysInWindow: 31,
  daysElapsed: 5,
  daysHit: 4,
  currentStreak: 1,
  percent: 0.8,
}

const WEIGHTED_LOAD: FocusLoadStats = {
  topSetLbs: 120,
  avgLoadLbs: 105,
  tonnageLbs: 5800,
  weightedSets: 6,
}

const BODYWEIGHT_LOAD: FocusLoadStats = {
  topSetLbs: null,
  avgLoadLbs: null,
  tonnageLbs: 0,
  weightedSets: 0,
}

describe('MonthlyFocusCard', () => {
  it('shows the focus label, exercise, and today progress against the target', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={60}
        adherence={ADHERENCE}
        loadStats={WEIGHTED_LOAD}
      />,
    )
    expect(screen.getByText('Focus of the Month')).toBeInTheDocument()
    expect(screen.getByText('shrugs')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText(/\/ 100 reps today/)).toBeInTheDocument()
  })

  it('renders windowed adherence (day, days-hit, streak)', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={60}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />,
    )
    expect(screen.getByText('5/31')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('1d')).toBeInTheDocument()
  })

  it('shows load stats only when the focus has weighted sets', () => {
    const { rerender } = render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={100}
        adherence={ADHERENCE}
        loadStats={WEIGHTED_LOAD}
      />,
    )
    expect(screen.getByText('Top set')).toBeInTheDocument()
    expect(screen.getByText('120 lb')).toBeInTheDocument()
    expect(screen.getByText('5,800 lb')).toBeInTheDocument()

    rerender(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={100}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />,
    )
    expect(screen.queryByText('Top set')).not.toBeInTheDocument()
  })

  it('marks the daily target as met when today progress reaches it', () => {
    render(
      <MonthlyFocusCard
        focus={FOCUS}
        todayProgress={100}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />,
    )
    expect(screen.getByTitle('Daily target met')).toBeInTheDocument()
  })

  it('labels the unit as "sets" for a sets-based target', () => {
    render(
      <MonthlyFocusCard
        focus={{ ...FOCUS, target_kind: 'sets', daily_target: 5 }}
        todayProgress={3}
        adherence={ADHERENCE}
        loadStats={BODYWEIGHT_LOAD}
      />,
    )
    expect(screen.getByText(/\/ 5 sets today/)).toBeInTheDocument()
  })
})
