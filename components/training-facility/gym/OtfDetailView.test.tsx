import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OtfData } from '@/types/otf'

import { OtfDetailView } from './OtfDetailView'

/**
 * Render tests for the OTF detail view (#256). `getOtfData` is mocked and the
 * heavy SVG chart children are stubbed to `null`, so the tests focus on the
 * branch decisions (loading → data, empty state, error panel) rather than
 * chart geometry. Sibling pattern: `StairDetailView.test.tsx`.
 */

const getOtfDataMock = vi.fn()

vi.mock('@/lib/data', () => ({ getOtfData: () => getOtfDataMock() }))
vi.mock('./OtfZoneBars', () => ({ OtfZoneBars: () => null }))
vi.mock('./OtfSparklineSummary', () => ({ OtfSparklineSummary: () => null }))
vi.mock('@/components/training-facility/shared/charts/RoughLine', () => ({ RoughLine: () => null }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/training-facility/gym/otf',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const VALID_SESSION = {
  started_at: '2026-06-27T16:30:00+00:00',
  coach: 'Mara Magistad',
  studio: 'Marina Del Rey, CA',
  splat: 15,
  calories: 776,
  avg_hr: 133,
  peak_hr: 164,
  zones_min: { gray: 1, blue: 11, green: 29, orange: 14, red: 1 },
  treadmill: { distance_mi: 1.09, time: '16:44' },
  rower: { distance_m: 2509, time: '13:54' },
}

const DATA: OtfData = {
  imported_at: '2026-06-30T07:53:00+00:00',
  sessions: [VALID_SESSION],
}

/** One valid class + one auto-excluded belt-malfunction anomaly (#268). */
const DATA_WITH_EXCLUDED: OtfData = {
  imported_at: '2026-06-30T07:53:00+00:00',
  sessions: [
    {
      started_at: '2026-05-30T16:30:00+00:00',
      coach: 'Jacob Buckenmeyer',
      studio: 'Marina Del Rey, CA',
      splat: 0,
      calories: 4,
      avg_hr: 94,
      peak_hr: 95,
      excluded: true,
      excluded_reason: 'auto: near-zero output with no treadmill or rower block',
    },
    VALID_SESSION,
  ],
}

beforeEach(() => {
  getOtfDataMock.mockReset()
})

describe('OtfDetailView', () => {
  it('always renders the header and a link back to the Gym', () => {
    getOtfDataMock.mockResolvedValue(DATA)
    render(<OtfDetailView />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /the gym/i })).toHaveAttribute(
      'href',
      '/training-facility/gym'
    )
  })

  it('renders the highlights strip and session log once data loads', async () => {
    getOtfDataMock.mockResolvedValue(DATA)
    render(<OtfDetailView />)
    await waitFor(() => expect(screen.getByText('Mara Magistad')).toBeInTheDocument())
    // Highlights strip (unique tile label) + the session-log heading.
    expect(screen.getByText('Total splat')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /classes/i })).toBeInTheDocument()
    // Splat value appears in both the tile and the table; just assert presence.
    expect(screen.getAllByText('15').length).toBeGreaterThan(0)
  })

  it('lists an excluded session in the log with a badge but keeps it out of the class count (#268)', async () => {
    getOtfDataMock.mockResolvedValue(DATA_WITH_EXCLUDED)
    render(<OtfDetailView />)
    // The anomaly's coach is still rendered — excluded rows stay in the log.
    await waitFor(() => expect(screen.getByText('Jacob Buckenmeyer')).toBeInTheDocument())
    // …flagged with an "Excluded" badge carrying the reason as its title.
    const badge = screen.getByText('Excluded')
    expect(badge).toHaveAttribute('title', expect.stringContaining('near-zero output'))
    // …and counted separately: 1 valid class in range, 1 excluded.
    expect(screen.getByText(/1 in range/)).toBeInTheDocument()
    expect(screen.getByText(/1 excluded/)).toBeInTheDocument()
    // Aggregates run over active sessions only: total calories is 776 (the
    // valid class), not 780 — the anomaly's 4 cal is left out.
    const calTile = screen.getByText('Total calories').closest('div') as HTMLElement
    expect(within(calTile).getByText('776')).toBeInTheDocument()
  })

  it('shows the empty state when there are no sessions', async () => {
    getOtfDataMock.mockResolvedValue(null)
    render(<OtfDetailView />)
    await waitFor(() =>
      expect(screen.getByText(/no orangetheory classes yet/i)).toBeInTheDocument()
    )
  })

  it('shows the error panel when the load throws', async () => {
    getOtfDataMock.mockRejectedValue(new Error('boom'))
    render(<OtfDetailView />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/boom/))
  })
})
