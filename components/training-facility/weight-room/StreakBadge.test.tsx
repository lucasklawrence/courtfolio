import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { StreakBadge } from './StreakBadge'

describe('StreakBadge', () => {
  it('shows the current streak count and exercise label', () => {
    render(
      <StreakBadge
        exercise="pushups"
        streak={{ current: 5, longest: 12 }}
        accentColor="#EA580C"
      />,
    )
    expect(screen.getByText('pushups')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('days')).toBeInTheDocument()
    expect(screen.getByText('12d')).toBeInTheDocument()
  })

  it('uses the singular "day" label when the current streak is exactly 1', () => {
    render(<StreakBadge exercise="pushups" streak={{ current: 1, longest: 1 }} />)
    expect(screen.getByText('day')).toBeInTheDocument()
    expect(screen.queryByText('days')).not.toBeInTheDocument()
  })

  it('hides the longest callout when longest is 0', () => {
    render(<StreakBadge exercise="pushups" streak={{ current: 0, longest: 0 }} />)
    expect(screen.queryByText(/longest/i)).not.toBeInTheDocument()
  })

  it('desaturates the flame when current is 0', () => {
    render(<StreakBadge exercise="pushups" streak={{ current: 0, longest: 5 }} />)
    const flame = screen.getByText('\u{1F525}')
    expect(flame.className).toContain('grayscale')
  })

  it('keeps the flame at full saturation when current > 0', () => {
    render(<StreakBadge exercise="pushups" streak={{ current: 2, longest: 2 }} />)
    const flame = screen.getByText('\u{1F525}')
    expect(flame.className).not.toContain('grayscale')
  })
})
