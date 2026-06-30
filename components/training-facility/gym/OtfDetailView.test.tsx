import { render, screen, waitFor } from '@testing-library/react'
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
vi.mock('@/components/training-facility/shared/charts/RoughLine', () => ({ RoughLine: () => null }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/training-facility/gym/otf',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const DATA: OtfData = {
  imported_at: '2026-06-30T07:53:00+00:00',
  sessions: [
    {
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
    },
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
