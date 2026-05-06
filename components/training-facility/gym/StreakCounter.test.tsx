import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { StreakCounter } from './StreakCounter'

describe('StreakCounter', () => {
  it('shows the current and longest day counts', () => {
    render(<StreakCounter streak={{ current: 5, longest: 12 }} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('day streak')).toBeInTheDocument()
    expect(screen.getByText('12d')).toBeInTheDocument()
  })

  it('renders the in-range stat only when filteredStreak.longest > 0', () => {
    const { rerender } = render(
      <StreakCounter
        streak={{ current: 3, longest: 10 }}
        filteredStreak={{ current: 0, longest: 4 }}
      />,
    )
    expect(screen.getByText(/in range/i)).toBeInTheDocument()
    expect(screen.getByText('4d')).toBeInTheDocument()

    rerender(
      <StreakCounter
        streak={{ current: 3, longest: 10 }}
        filteredStreak={{ current: 0, longest: 0 }}
      />,
    )
    expect(screen.queryByText(/in range/i)).not.toBeInTheDocument()
  })

  it('desaturates the flame when the current streak is 0', () => {
    render(<StreakCounter streak={{ current: 0, longest: 8 }} />)
    const flame = screen.getByText('\u{1F525}')
    expect(flame.className).toContain('grayscale')
  })

  it('keeps the flame at full saturation when current > 0', () => {
    render(<StreakCounter streak={{ current: 1, longest: 1 }} />)
    const flame = screen.getByText('\u{1F525}')
    expect(flame.className).not.toContain('grayscale')
  })
})
