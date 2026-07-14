import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { OtfMileageAward, OtfSession } from '@/types/otf'

import { OtfMileageSection } from './OtfMileageSection'

/**
 * Aggregation and award math live in `otf-mileage.test.ts`; these tests assert
 * the DOM this component owns — the headline current-month card, earned-badge
 * chips, progress-to-next copy, the scrollable history, and the admin-only
 * Milestones link.
 */

/** A session covering `treadMiles` on the tread, dated midday-UTC for tz stability. */
function ride(started_at: string, treadMiles: number): OtfSession {
  return { started_at, treadmill: { distance_mi: treadMiles, time: '20:00' } }
}

const AWARDS: OtfMileageAward[] = [
  { id: 'a', label: 'Half Marathon', miles: 13.1, color: '#FBBF24' },
  { id: 'b', label: 'Marathon', miles: 26.2, color: '#F97316' },
  { id: 'c', label: '50K Ultra', miles: 31.1, color: '#EA580C' },
]

/** July 13, 2026 (local) — the fixed "now" for every case. */
const NOW = new Date(2026, 6, 13)

describe('OtfMileageSection', () => {
  it('headlines the current month with its miles and an earned badge', () => {
    render(
      <OtfMileageSection
        sessions={[ride('2026-07-02T12:00:00Z', 10), ride('2026-07-09T12:00:00Z', 5)]}
        awards={AWARDS}
        now={NOW}
      />,
    )
    expect(screen.getByText('July 2026')).toBeInTheDocument()
    expect(screen.getByText('15.0')).toBeInTheDocument()
    expect(screen.getByText('2 classes')).toBeInTheDocument()
    // 15 mi clears the half but not the marathon.
    expect(screen.getByText('Half Marathon')).toBeInTheDocument()
    expect(screen.getByText('11.2 mi to Marathon')).toBeInTheDocument()
  })

  it('shows a zero current month and points at the first tier when nothing is logged yet', () => {
    render(<OtfMileageSection sessions={[]} awards={AWARDS} now={NOW} />)
    expect(screen.getByText('0.0')).toBeInTheDocument()
    expect(screen.getByText('No milestone yet this month.')).toBeInTheDocument()
    expect(screen.getByText('13.1 mi to Half Marathon')).toBeInTheDocument()
    expect(screen.getByText('No earlier months logged yet.')).toBeInTheDocument()
  })

  it('celebrates once every milestone is cleared', () => {
    render(<OtfMileageSection sessions={[ride('2026-07-01T12:00:00Z', 40)]} awards={AWARDS} now={NOW} />)
    expect(screen.getByText('Every milestone cleared 🎉')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('lists prior months newest first and keeps them out of the headline', () => {
    render(
      <OtfMileageSection
        sessions={[
          ride('2026-07-05T12:00:00Z', 4),
          ride('2026-06-10T12:00:00Z', 14),
          ride('2026-05-10T12:00:00Z', 2),
        ]}
        awards={AWARDS}
        now={NOW}
      />,
    )
    const history = screen.getByText('Earlier months').closest('div') as HTMLElement
    const rows = within(history).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('June 2026')
    expect(rows[0]).toHaveTextContent('14.0 mi')
    expect(rows[1]).toHaveTextContent('May 2026')
  })

  it('renders the admin Milestones link only for admins', () => {
    const { rerender } = render(
      <OtfMileageSection sessions={[]} awards={AWARDS} now={NOW} isAdmin={false} />,
    )
    expect(screen.queryByRole('link', { name: 'Milestones' })).not.toBeInTheDocument()

    rerender(<OtfMileageSection sessions={[]} awards={AWARDS} now={NOW} isAdmin />)
    const link = screen.getByRole('link', { name: 'Milestones' })
    expect(link).toHaveAttribute('href', '/training-facility/gym/otf/settings')
  })

  it('still renders miles with no badges when the ladder is empty', () => {
    render(<OtfMileageSection sessions={[ride('2026-07-03T12:00:00Z', 3)]} awards={[]} now={NOW} />)
    expect(screen.getByText('3.0')).toBeInTheDocument()
    expect(screen.getByText('No milestone yet this month.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
