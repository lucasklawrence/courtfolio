import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { CardioTimePoint } from '@/types/cardio'
import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import { StrengthVsBodyweightChart } from './StrengthVsBodyweightChart'

/**
 * Coverage for the relative-strength chart's legend and its
 * not-enough-data fallback. The rough.js line layers have their own tests; the
 * point here is that the two series are *named*, since two lines on two
 * different y-axes are unreadable without knowing which is which.
 */

const GOAL: ExerciseGoal = { exercise: 'pullups', daily_target: 30, color: '#0EA5A1' }

/** Sets across enough completed weeks that the chart clears its 2-week floor. */
function weeklySets(): StrengthSet[] {
  const days = ['2026-06-15', '2026-06-22', '2026-06-29', '2026-07-06', '2026-07-13']
  return days.map((day, i) => ({
    id: `s${i}`,
    logged_at: `${day}T19:00:00Z`,
    exercise: 'pullups',
    reps: 40 + i,
  }))
}

const BODY_MASS: CardioTimePoint[] = [
  { date: '2026-06-16', value: 236 },
  { date: '2026-07-07', value: 233 },
]

describe('StrengthVsBodyweightChart legend', () => {
  it('names both series, keyed to the exercise', () => {
    render(
      <StrengthVsBodyweightChart sets={weeklySets()} goal={GOAL} bodyMass={BODY_MASS} />,
    )
    expect(screen.getByText('pullups / week')).toBeInTheDocument()
    expect(screen.getByText('Bodyweight (lb)')).toBeInTheDocument()
  })

  it('draws the exercise swatch in the goal colour and dashes only bodyweight', () => {
    const { container } = render(
      <StrengthVsBodyweightChart sets={weeklySets()} goal={GOAL} bodyMass={BODY_MASS} />,
    )
    const swatches = [...container.querySelectorAll('li svg line')]
    expect(swatches).toHaveLength(2)
    expect(swatches[0]).toHaveAttribute('stroke', '#0EA5A1')
    expect(swatches[0]).not.toHaveAttribute('stroke-dasharray')
    // Matches how the overlay strokes the secondary series.
    expect(swatches[1]).toHaveAttribute('stroke-dasharray')
  })

  it('still labels bodyweight when none is logged — the axis exists either way', () => {
    render(<StrengthVsBodyweightChart sets={weeklySets()} goal={GOAL} bodyMass={[]} />)
    expect(screen.getByText('Bodyweight (lb)')).toBeInTheDocument()
  })

  it('omits the legend when there are too few weeks to plot', () => {
    // Below two completed weeks the chart renders its empty-state line instead,
    // so there are no series to name. Freeze the clock so the set date
    // (2026-07-13, a Monday) always falls in the current in-progress week and
    // is excluded by the `slice(0, -1)` trim — without this the test breaks
    // once real time advances past that week.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-17T12:00:00.000Z'))
    const oneWeek: StrengthSet[] = [
      { id: 'a', logged_at: '2026-07-13T19:00:00Z', exercise: 'pullups', reps: 40 },
    ]
    try {
      render(<StrengthVsBodyweightChart sets={oneWeek} goal={GOAL} bodyMass={BODY_MASS} />)
      expect(screen.queryByText('pullups / week')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
