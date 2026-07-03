import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CardioData } from '@/types/cardio'
import type { OtfData } from '@/types/otf'

import { HrZoneComparison } from './HrZoneComparison'

/**
 * Render tests for the HR-zone reconciliation view (#261). Both data readers
 * are mocked; the tests focus on branch decisions (loading → data, empty,
 * error) and that both systems' derived boundaries surface. Sibling pattern:
 * `OtfDetailView.test.tsx`.
 */

const getCardioDataMock = vi.fn()
const getOtfDataMock = vi.fn()

vi.mock('@/lib/data', () => ({
  getCardioData: () => getCardioDataMock(),
  getOtfData: () => getOtfDataMock(),
}))
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

beforeEach(() => {
  getCardioDataMock.mockReset()
  getOtfDataMock.mockReset()
})

describe('HrZoneComparison', () => {
  it('renders the header and a link back to the OrangeTheory view', () => {
    getCardioDataMock.mockResolvedValue(CARDIO)
    getOtfDataMock.mockResolvedValue(OTF)
    render(<HrZoneComparison />)
    expect(screen.getByRole('heading', { level: 1, name: /apple watch vs orangetheory/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /orangetheory/i })).toHaveAttribute(
      'href',
      '/training-facility/gym/otf',
    )
  })

  it('derives the shared max HR from the observed peak and renders both systems', async () => {
    getCardioDataMock.mockResolvedValue(CARDIO)
    getOtfDataMock.mockResolvedValue(OTF)
    render(<HrZoneComparison />)

    await waitFor(() => expect(screen.getByText('Shared max HR')).toBeInTheDocument())

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

  it('ignores excluded OTF sessions when deriving the shared max HR (#268)', async () => {
    getCardioDataMock.mockResolvedValue(CARDIO)
    getOtfDataMock.mockResolvedValue({
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
    } satisfies OtfData)
    render(<HrZoneComparison />)

    await waitFor(() => expect(screen.getByText('Shared max HR')).toBeInTheDocument())
    // Still 175 (the valid peak), not 210 from the excluded session.
    expect(screen.getByText('175')).toBeInTheDocument()
    expect(screen.queryByText('210')).not.toBeInTheDocument()
  })

  it('shows the empty state when neither system logged zone time', async () => {
    getCardioDataMock.mockResolvedValue(null)
    getOtfDataMock.mockResolvedValue({
      imported_at: '',
      sessions: [{ started_at: '2026-06-27T16:30:00+00:00', peak_hr: 170 }],
    } satisfies OtfData)
    render(<HrZoneComparison />)
    await waitFor(() => expect(screen.getByText(/no time-in-zone yet/i)).toBeInTheDocument())
    // Max HR callout still resolves the observed peak even with no zone time.
    expect(screen.getByText('170')).toBeInTheDocument()
  })

  it('renders the empty state (not an error) when both tables are empty', async () => {
    // Both readers resolve null on an empty table — the sibling views' empty
    // contract. That is not a failure; it should not surface the error panel.
    getCardioDataMock.mockResolvedValue(null)
    getOtfDataMock.mockResolvedValue(null)
    render(<HrZoneComparison />)
    await waitFor(() => expect(screen.getByText(/no time-in-zone yet/i)).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error panel when a data read genuinely fails', async () => {
    // A real query/schema failure rejects (rather than resolving null); it must
    // surface, not be masked into a partial "the other source is just empty".
    getCardioDataMock.mockRejectedValue(new Error('boom'))
    getOtfDataMock.mockResolvedValue(OTF)
    render(<HrZoneComparison />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/boom/))
  })
})
