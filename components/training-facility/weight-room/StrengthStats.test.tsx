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
  targetChanges: [],
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

describe('StrengthStats — goal changes (#362)', () => {
  it('renders no goal-changes footer when the target has never moved', () => {
    const { queryByTestId } = render(<StrengthStats stats={[PUSHUP_STATS]} />)
    expect(queryByTestId('strength-stat-goal-changes-pushups')).toBeNull()
  })

  it('lists each target change with its old value, new value, and date', () => {
    const { getByTestId } = render(
      <StrengthStats
        stats={[
          {
            ...PUSHUP_STATS,
            exercise: 'pullups',
            dailyTarget: 50,
            targetChanges: [{ from: 30, to: 50, effective_from: '2026-08-01' }],
          },
        ]}
      />,
    )
    const footer = getByTestId('strength-stat-goal-changes-pullups')
    expect(footer).toHaveTextContent('30')
    expect(footer).toHaveTextContent('50')
    expect(footer).toHaveTextContent('Aug 1')
  })

  it('lists multiple changes oldest-first', () => {
    const { getByTestId } = render(
      <StrengthStats
        stats={[
          {
            ...PUSHUP_STATS,
            targetChanges: [
              { from: 100, to: 150, effective_from: '2026-06-01' },
              { from: 150, to: 200, effective_from: '2026-09-01' },
            ],
          },
        ]}
      />,
    )
    const items = getByTestId('strength-stat-goal-changes-pushups').querySelectorAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Jun 1')
    expect(items[1].textContent).toContain('Sep 1')
  })
})

describe('StrengthStats — focus rotations (#367)', () => {
  /** Campaign summary for a rotation that has ended. */
  const CLOSED_FOCUS = {
    status: 'ended' as const,
    isActive: false,
    rotations: 1,
    daysHit: 26,
    daysElapsed: 31,
    campaignReps: 3113,
    latestWindowLabel: 'Jul 1 – Jul 31',
  }

  const SHRUGS_STATS: StrengthExerciseStats = {
    ...PUSHUP_STATS,
    exercise: 'shrugs',
    color: '#C9A268',
    dailyTarget: 100,
    thisWeekReps: 0,
    lastWeekReps: 0,
    thisMonthReps: 0,
    lastMonthReps: 0,
    focus: CLOSED_FOCUS,
  }

  it('renders a GTG badge and the window label for a focus exercise', () => {
    const { getByTestId } = render(<StrengthStats stats={[SHRUGS_STATS]} />)
    expect(getByTestId('strength-stat-focus-badge-shrugs')).toBeInTheDocument()
    expect(getByTestId('strength-stat-card-shrugs')).toHaveTextContent('Jul 1 – Jul 31')
  })

  it('swaps the dead week/month cells for campaign numbers once the window closes', () => {
    const { getByTestId } = render(<StrengthStats stats={[SHRUGS_STATS]} />)
    const card = getByTestId('strength-stat-card-shrugs')
    expect(card).toHaveTextContent('26/31')
    expect(card).toHaveTextContent('days hit')
    expect(card).toHaveTextContent('3,113')
    expect(card).toHaveTextContent('campaign reps')
    // The zero-value cells a closed campaign would otherwise show are gone.
    expect(card).not.toHaveTextContent('this week')
    expect(card).not.toHaveTextContent('this month')
  })

  it('keeps the week/month cells while the rotation is still live', () => {
    const { getByTestId } = render(
      <StrengthStats
        stats={[
          {
            ...SHRUGS_STATS,
            thisWeekReps: 380,
            focus: { ...CLOSED_FOCUS, status: 'active' as const, isActive: true },
          },
        ]}
      />,
    )
    const card = getByTestId('strength-stat-card-shrugs')
    expect(card).toHaveTextContent('this week')
    expect(card).toHaveTextContent('380')
    expect(card).not.toHaveTextContent('campaign reps')
  })

  it('notes the rotation count when an exercise has run more than once', () => {
    const { getByTestId } = render(
      <StrengthStats stats={[{ ...SHRUGS_STATS, focus: { ...CLOSED_FOCUS, rotations: 2 } }]} />,
    )
    expect(getByTestId('strength-stat-card-shrugs')).toHaveTextContent('2 rotations')
  })

  it('renders no focus chrome for a permanent goal', () => {
    const { queryByTestId, getByTestId } = render(<StrengthStats stats={[PUSHUP_STATS]} />)
    expect(queryByTestId('strength-stat-focus-badge-pushups')).toBeNull()
    expect(getByTestId('strength-stat-card-pushups')).toHaveTextContent('this week')
  })
})

describe('StrengthStats — upcoming rotations (#367 review)', () => {
  /** A scheduled campaign: inactive, but nothing has elapsed yet. */
  const UPCOMING_FOCUS = {
    status: 'upcoming' as const,
    isActive: false,
    rotations: 1,
    daysHit: 0,
    daysElapsed: 0,
    campaignReps: 0,
    latestWindowLabel: 'Oct 1 – Oct 31',
  }

  it('does not render a scheduled rotation as a finished one', () => {
    const { getByTestId } = render(
      <StrengthStats
        stats={[
          {
            ...PUSHUP_STATS,
            exercise: 'calf-raises',
            thisWeekReps: 0,
            focus: UPCOMING_FOCUS,
          },
        ]}
      />,
    )
    const card = getByTestId('strength-stat-card-calf-raises')
    // A bare `!isActive` check would swap in campaign cells here and show a
    // meaningless "0/0 days hit" for a campaign that hasn't started.
    expect(card).not.toHaveTextContent('days hit')
    expect(card).toHaveTextContent('this week')
    expect(card).toHaveTextContent('Oct 1 – Oct 31')
  })

  it('labels the badge as upcoming rather than past', () => {
    const { getByTestId } = render(
      <StrengthStats stats={[{ ...PUSHUP_STATS, focus: UPCOMING_FOCUS }]} />,
    )
    expect(getByTestId('strength-stat-focus-badge-pushups')).toHaveAttribute(
      'title',
      'Upcoming grease-the-groove rotation',
    )
  })
})

describe('StrengthStats — catalog labels (#384)', () => {
  it('renders the catalog display name instead of the slug', () => {
    const { getByText, queryByText } = render(
      <StrengthStats
        stats={[{ ...PUSHUP_STATS, exercise: 'barbell-bench-press', displayName: 'Barbell Bench Press' }]}
      />,
    )
    expect(getByText('Barbell Bench Press')).toBeInTheDocument()
    expect(queryByText('barbell-bench-press')).toBeNull()
  })

  it('keys the card off the slug, not the label', () => {
    // Identity stays the slug so test hooks, URLs, and React keys are stable
    // across a rename in the catalog.
    const { getByTestId } = render(
      <StrengthStats
        stats={[{ ...PUSHUP_STATS, exercise: 'barbell-bench-press', displayName: 'Barbell Bench Press' }]}
      />,
    )
    expect(getByTestId('strength-stat-card-barbell-bench-press')).toBeInTheDocument()
  })

  it('falls back to the slug when the catalog has no label', () => {
    const { getByText } = render(<StrengthStats stats={[PUSHUP_STATS]} />)
    expect(getByText('pushups')).toBeInTheDocument()
  })
})

