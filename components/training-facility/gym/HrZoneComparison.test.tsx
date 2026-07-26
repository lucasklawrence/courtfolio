import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { CardioData } from '@/types/cardio'
import type { OtfData } from '@/types/otf'

import { HrZoneComparison } from './HrZoneComparison'

/**
 * Render tests for the HR-zone reconciliation view (#261). Data arrives as
 * props now that the page reads it server-side (#345), so there is no reader to
 * mock and no async settle to await — the tests focus on branch decisions
 * (data, empty, error) and on both systems' derived boundaries surfacing.
 * Sibling pattern: `OtfDetailView.test.tsx`.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/training-facility/gym/zones',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const CARDIO: CardioData = {
  imported_at: '2026-06-30T07:53:00+00:00',
  sessions: [
    {
      date: '2026-06-27',
      activity: 'stair',
      duration_seconds: 600,
      max_hr: 158,
      hr_seconds_in_zone: { 1: 0, 2: 300, 3: 300, 4: 0, 5: 0 },
    },
  ],
  resting_hr_trend: [],
  vo2max_trend: [],
}

const OTF: OtfData = {
  imported_at: '2026-06-30T07:53:00+00:00',
  sessions: [
    {
      started_at: '2026-06-27T16:30:00+00:00',
      peak_hr: 175,
      avg_hr: 125,
      zones_min: { gray: 1, blue: 11, green: 29, orange: 14, red: 1 },
    },
  ],
}

describe('HrZoneComparison', () => {
  it('renders the header and a link back to the OrangeTheory view', () => {
    render(<HrZoneComparison cardio={CARDIO} otf={OTF} />)
    expect(screen.getByRole('heading', { level: 1, name: /apple watch vs orangetheory/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /orangetheory/i })).toHaveAttribute(
      'href',
      '/training-facility/gym/otf',
    )
  })

  it('derives the shared max HR from the observed peak and renders both systems', async () => {
    render(<HrZoneComparison cardio={CARDIO} otf={OTF} />)

    expect(screen.getByText('Shared max HR')).toBeInTheDocument()

    // Observed peak 175 wins over the cardio max of 158.
    expect(screen.getByText('175')).toBeInTheDocument()
    // Both system cards render.
    expect(screen.getByRole('heading', { name: 'Apple Watch' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'OrangeTheory' })).toBeInTheDocument()
    // A derived Apple boundary (Z1 at 175 = 88–105) is shown.
    expect(screen.getAllByText('88–105').length).toBeGreaterThan(0)
    // The recommendation note is always present with data.
    expect(screen.getByRole('heading', { name: /which to follow/i })).toBeInTheDocument()
  })

  it('ignores excluded OTF sessions when deriving the shared max HR (#268)', () => {
    const withAnomaly = {
      imported_at: '2026-06-30T07:53:00+00:00',
      sessions: [
        ...OTF.sessions,
        // Anomaly with a bogus sky-high peak — must not become the shared max.
        {
          started_at: '2026-05-30T16:30:00+00:00',
          peak_hr: 210,
          avg_hr: 200,
          excluded: true,
          excluded_reason: 'auto: equipment malfunction',
        },
      ],
    } satisfies OtfData
    render(<HrZoneComparison cardio={CARDIO} otf={withAnomaly} />)

    expect(screen.getByText('Shared max HR')).toBeInTheDocument()
    // Still 175 (the valid peak), not 210 from the excluded session.
    expect(screen.getByText('175')).toBeInTheDocument()
    expect(screen.queryByText('210')).not.toBeInTheDocument()
  })

  it('shows the empty state when neither system logged zone time', () => {
    const noZoneTime = {
      imported_at: '',
      sessions: [{ started_at: '2026-06-27T16:30:00+00:00', peak_hr: 170 }],
    } satisfies OtfData
    render(<HrZoneComparison cardio={null} otf={noZoneTime} />)
    expect(screen.getByText(/no time-in-zone yet/i)).toBeInTheDocument()
    // Max HR callout still resolves the observed peak even with no zone time.
    expect(screen.getByText('170')).toBeInTheDocument()
  })

  it('renders the empty state (not an error) when both tables are empty', () => {
    // Both readers resolve null on an empty table — the sibling views' empty
    // contract. That is not a failure; it should not surface the error panel.
    render(<HrZoneComparison cardio={null} otf={null} />)
    expect(screen.getByText(/no time-in-zone yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error panel when a data read genuinely fails', () => {
    // A real query/schema failure rejects server-side (rather than resolving
    // null); the page forwards the message so it surfaces here rather than
    // being masked into a partial "the other source is just empty".
    render(<HrZoneComparison cardio={null} otf={OTF} loadError="boom" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/boom/)
  })
})
