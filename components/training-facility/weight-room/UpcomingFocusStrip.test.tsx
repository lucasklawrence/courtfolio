import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { MonthlyFocus } from '@/types/weight-room'

import { UpcomingFocusStrip } from './UpcomingFocusStrip'

const SHRUGS: MonthlyFocus = {
  id: 'f1',
  exercise: 'shrugs',
  daily_target: 100,
  target_kind: 'reps',
  color: '#C9A268',
  category: 'upper',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
}

const CALVES: MonthlyFocus = {
  id: 'f2',
  exercise: 'calf-raises',
  daily_target: 150,
  target_kind: 'reps',
  color: '#0EA5A1',
  category: 'lower',
  start_date: '2026-08-01',
  end_date: '2026-08-31',
}

describe('UpcomingFocusStrip', () => {
  it('renders nothing when there are no upcoming focuses', () => {
    const { container } = render(<UpcomingFocusStrip focuses={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists each upcoming focus with its exercise and month', () => {
    render(<UpcomingFocusStrip focuses={[SHRUGS, CALVES]} />)
    expect(screen.getByText('Up Next')).toBeInTheDocument()
    expect(screen.getByTestId('upcoming-focus-shrugs')).toBeInTheDocument()
    expect(screen.getByTestId('upcoming-focus-calf-raises')).toBeInTheDocument()
    // Month label derived from start_date (locale-formatted; assert the year is present).
    expect(screen.getByTestId('upcoming-focus-shrugs').textContent).toMatch(/2026/)
  })

  it('tags each chip with its body-region category', () => {
    render(<UpcomingFocusStrip focuses={[SHRUGS, CALVES]} />)
    expect(screen.getByTestId('upcoming-focus-shrugs-category').textContent).toBe('upper')
    expect(screen.getByTestId('upcoming-focus-calf-raises-category').textContent).toBe('lower')
  })
})
