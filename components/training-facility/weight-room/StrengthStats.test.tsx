import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import type { StrengthExerciseStats } from '@/lib/training-facility/weight-room-history'

import { StrengthStats } from './StrengthStats'

const PUSHUP_STATS: StrengthExerciseStats = {
  exercise: 'pushups',
  color: '#EA580C',
  dailyTarget: 100,
  currentStreak: 4,
  longestStreak: 12,
  thisWeekReps: 380,
  lastWeekReps: 220,
  thisMonthReps: 1450,
  lastMonthReps: 980,
  avgSetsPerActiveDay: 3.5,
  allTimeReps: 12_400,
}

describe('StrengthStats', () => {
  it('renders the empty-state copy when stats is empty', () => {
    const { getByTestId } = render(<StrengthStats stats={[]} />)
    expect(getByTestId('strength-stats-empty')).toBeInTheDocument()
  })

  it('renders one card per exercise', () => {
    const { getByTestId } = render(
      <StrengthStats
        stats={[
          PUSHUP_STATS,
          { ...PUSHUP_STATS, exercise: 'pullups', color: '#0EA5A1', allTimeReps: 0 },
        ]}
      />,
    )
    expect(getByTestId('strength-stat-card-pushups')).toBeInTheDocument()
    expect(getByTestId('strength-stat-card-pullups')).toBeInTheDocument()
  })

  it('shows current streak, longest streak, and goal target', () => {
    const { getByTestId } = render(<StrengthStats stats={[PUSHUP_STATS]} />)
    const card = getByTestId('strength-stat-card-pushups')
    expect(card.textContent).toContain('4')
    expect(card.textContent).toContain('12')
    expect(card.textContent).toContain('goal 100/day')
  })

  it('shows weekly and monthly totals with prior-period comparison', () => {
    const { getByTestId } = render(<StrengthStats stats={[PUSHUP_STATS]} />)
    const card = getByTestId('strength-stat-card-pushups')
    expect(card.textContent).toContain('380')
    expect(card.textContent).toContain('vs 220 prior')
    expect(card.textContent).toContain('1,450')
    expect(card.textContent).toContain('vs 980 prior')
  })

  it('shows average sets per active day with one decimal', () => {
    const { getByTestId } = render(<StrengthStats stats={[PUSHUP_STATS]} />)
    const card = getByTestId('strength-stat-card-pushups')
    expect(card.textContent).toContain('3.5')
  })

  it('falls back to em-dash when avg sets per active day is zero', () => {
    const { getByTestId } = render(
      <StrengthStats stats={[{ ...PUSHUP_STATS, avgSetsPerActiveDay: 0 }]} />,
    )
    const card = getByTestId('strength-stat-card-pushups')
    expect(card.textContent).toContain('—')
  })

  it('formats all-time reps with thousands separators', () => {
    const { getByTestId } = render(<StrengthStats stats={[PUSHUP_STATS]} />)
    const card = getByTestId('strength-stat-card-pushups')
    expect(card.textContent).toContain('12,400')
  })

  it('uses the exercise color on the heading', () => {
    const { getByText } = render(<StrengthStats stats={[PUSHUP_STATS]} />)
    const heading = getByText('pushups')
    // jsdom canonicalizes inline `style` to lowercase rgb(); accept either.
    const styleAttr = heading.getAttribute('style') ?? ''
    expect(styleAttr).toMatch(/#EA580C|rgb\(\s*234,\s*88,\s*12\s*\)/i)
  })
})
