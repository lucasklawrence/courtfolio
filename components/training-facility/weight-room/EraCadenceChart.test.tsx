/**
 * Tests for the cadence chart (#437).
 *
 * The acceptance criterion this defends is "the gap renders as a gap": the
 * empty months have to reach the chart and be named, not be filtered out on the
 * way in — a series that skips them draws the two eras shoulder to shoulder.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EraMonth } from '@/lib/training-facility/log-eras'

import { EraCadenceChart } from './EraCadenceChart'

function month(monthKey: string, era: EraMonth['era'], trainingDays = 0): EraMonth {
  return { monthKey, trainingDays, era }
}

const MONTHS: EraMonth[] = [
  month('2024-03', 'then', 8),
  month('2024-04', 'then', 6),
  month('2024-05', 'gap'),
  month('2024-06', 'gap'),
  month('2024-07', 'gap'),
  month('2026-05', 'now', 4),
  month('2026-06', 'now', 22),
]

describe('EraCadenceChart', () => {
  it('renders a bar for every month, empty ones included', () => {
    const { container } = render(<EraCadenceChart months={MONTHS} />)
    // Each bar emits at least one path; the count only has to grow with the
    // months, which is what proves the gap wasn't filtered out.
    const withGap = container.querySelectorAll('path').length
    const { container: noGap } = render(
      <EraCadenceChart months={MONTHS.filter(m => m.era !== 'gap')} />
    )
    expect(withGap).toBeGreaterThan(noGap.querySelectorAll('path').length)
  })

  it('names the layoff beneath the chart, in prose rather than sort keys', () => {
    render(<EraCadenceChart months={MONTHS} />)
    const note = screen.getByTestId('era-gap-note')
    expect(note).toHaveTextContent('May 2024')
    expect(note).toHaveTextContent('July 2024')
    expect(note).toHaveTextContent('3 months')
    // The raw `YYYY-MM` keys are sort keys, not something a reader should see.
    expect(note).not.toHaveTextContent('2024-05')
  })

  it('omits the note when the log has no layoff', () => {
    render(<EraCadenceChart months={MONTHS.filter(m => m.era !== 'gap')} />)
    expect(screen.queryByTestId('era-gap-note')).toBeNull()
  })

  it('widens with the span so a long log stays legible when scrolled', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      month(`2020-${String((i % 12) + 1).padStart(2, '0')}-${i}`, 'then', 5)
    )
    const { container } = render(<EraCadenceChart months={many} />)
    const svg = container.querySelector('svg')
    expect(Number(svg?.getAttribute('width'))).toBeGreaterThan(1000)
  })
})
