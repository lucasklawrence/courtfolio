import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { ExerciseGoal } from '@/types/weight-room'

import { ActivityRings } from './ActivityRings'

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 100,
  color: '#EA580C',
}
const PULLUPS: ExerciseGoal = {
  exercise: 'pullups',
  daily_target: 30,
  color: '#0EA5A1',
}

describe('ActivityRings', () => {
  it('renders one <g> per ring with stable testids', () => {
    render(
      <ActivityRings
        rings={[
          { goal: PUSHUPS, totalReps: 50 },
          { goal: PULLUPS, totalReps: 10 },
        ]}
      />,
    )
    expect(screen.getByTestId('ring-pushups')).toBeInTheDocument()
    expect(screen.getByTestId('ring-pullups')).toBeInTheDocument()
  })

  it('shows the primary exercise reps / goal in the center readout', () => {
    render(<ActivityRings rings={[{ goal: PUSHUPS, totalReps: 75 }]} />)
    expect(screen.getByText('pushups')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('/ 100')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders the over-fill raw count but caps the visual ring at 100%', () => {
    render(<ActivityRings rings={[{ goal: PUSHUPS, totalReps: 125 }]} />)
    // The over-fill is visible in the readout
    expect(screen.getByText('125')).toBeInTheDocument()
    expect(screen.getByText('125%')).toBeInTheDocument()

    // The dashoffset on the progress circle clamps to 0 (full sweep)
    const ring = screen.getByTestId('ring-pushups')
    const circles = ring.querySelectorAll('circle')
    // Second circle is the progress arc (first is the track)
    expect(circles[1].getAttribute('stroke-dashoffset')).toBe('0')
  })

  it('renders an empty placeholder when rings is empty', () => {
    render(<ActivityRings rings={[]} />)
    expect(screen.getByText(/add a goal in settings/i)).toBeInTheDocument()
    expect(screen.queryByTestId('activity-rings')).not.toBeInTheDocument()
  })

  it('exposes an aria-label that summarizes every ring', () => {
    render(
      <ActivityRings
        rings={[
          { goal: PUSHUPS, totalReps: 50 },
          { goal: PULLUPS, totalReps: 15 },
        ]}
      />,
    )
    const svg = screen.getByRole('img')
    expect(svg).toHaveAttribute(
      'aria-label',
      expect.stringContaining('pushups 50 of 100'),
    )
    expect(svg).toHaveAttribute(
      'aria-label',
      expect.stringContaining('pullups 15 of 30'),
    )
  })
})
