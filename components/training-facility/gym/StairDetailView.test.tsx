import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { CARDIO_DEMO_DATA } from '@/constants/cardio-demo-fixture'
import type { CardioData } from '@/types/cardio'

import { StairDetailView } from './StairDetailView'

/**
 * Wiring tests for the Stair detail view's empty-state preview
 * affordance (#162). Stair is the representative cardio surface —
 * Treadmill / Track / AllCardioOverview share the same hook + same
 * shared-component imports, so confirming the Stair plumbing is enough
 * to pin the pattern. The hook's decision logic is covered separately
 * in `lib/training-facility/use-cardio-preview.test.ts`.
 *
 * Heavy chart children are stubbed to keep the test focused on the
 * branch decisions (badge rendered, CTA rendered, neither). The point
 * is not to render real SVGs — those have their own coverage.
 */

const getCardioDataMock = vi.fn()
vi.mock('@/lib/data', () => ({
  getCardioData: () => getCardioDataMock(),
}))

const searchParamsMock = vi.fn<() => URLSearchParams>(() => new URLSearchParams())
const pathnameMock = vi.fn<() => string>(() => '/training-facility/gym/stair')
const routerReplaceMock = vi.fn<(href: string) => void>()
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
  usePathname: () => pathnameMock(),
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn(), prefetch: vi.fn() }),
}))

// Stub the chart children — they're not the subject of this test.
vi.mock('./HrZoneBars', () => ({ HrZoneBars: () => null }))
vi.mock('./AvgHrBars', () => ({ AvgHrBars: () => null }))
vi.mock('./TrainingLoadChart', () => ({ TrainingLoadChart: () => null }))
vi.mock('./PersonalBests', () => ({ PersonalBests: () => null }))
vi.mock('./MaxHrControl', () => ({ MaxHrControl: () => null }))
vi.mock('@/components/training-facility/shared/CardioStatsCards', () => ({
  CardioStatsCards: () => null,
}))

const populatedStair: CardioData = {
  imported_at: '2026-01-01T00:00:00Z',
  sessions: [
    {
      date: '2026-01-01T00:00:00Z',
      activity: 'stair',
      duration_seconds: 1500,
      avg_hr: 150,
      max_hr: 170,
    },
  ],
  resting_hr_trend: [],
  vo2max_trend: [],
}

const populatedRunningOnly: CardioData = {
  imported_at: '2026-01-01T00:00:00Z',
  sessions: [
    {
      date: '2026-01-01T00:00:00Z',
      activity: 'running',
      duration_seconds: 1500,
      avg_hr: 150,
      max_hr: 170,
    },
  ],
  resting_hr_trend: [],
  vo2max_trend: [],
}

beforeEach(() => {
  getCardioDataMock.mockReset()
  searchParamsMock.mockReset()
  searchParamsMock.mockReturnValue(new URLSearchParams())
  pathnameMock.mockReset()
  pathnameMock.mockReturnValue('/training-facility/gym/stair')
  routerReplaceMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StairDetailView preview wiring (#162)', () => {
  it('shows the empty-state CTA when no stair sessions and no preview param', async () => {
    getCardioDataMock.mockResolvedValueOnce(null)
    render(<StairDetailView />)

    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: /preview with sample data/i }),
      ).toBeInTheDocument(),
    )
    // CTA href is sourced from `usePathname()` so a route move follows along.
    expect(
      screen.getByRole('link', { name: /preview with sample data/i }),
    ).toHaveAttribute('href', '/training-facility/gym/stair?preview=demo')
    expect(screen.queryByText(/preview — sample data/i)).not.toBeInTheDocument()
  })

  it('shows the badge and the demo fixture when preview=demo and no real stair sessions', async () => {
    getCardioDataMock.mockResolvedValueOnce(null)
    searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))
    render(<StairDetailView />)

    await waitFor(() => expect(getCardioDataMock).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByText(/preview — sample data/i)).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('link', { name: /preview with sample data/i }),
    ).not.toBeInTheDocument()
  })

  it('shows the preview affordance when real DB has sessions but none for stair (activity scoping)', async () => {
    // The hook's `requireActivity: 'stair'` path — real running data
    // shouldn't suppress the preview here because Stair has nothing
    // to render either way.
    getCardioDataMock.mockResolvedValueOnce(populatedRunningOnly)
    render(<StairDetailView />)

    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: /preview with sample data/i }),
      ).toBeInTheDocument(),
    )
  })

  it('hides both preview surfaces when real stair sessions exist (real data wins)', async () => {
    getCardioDataMock.mockResolvedValueOnce(populatedStair)
    searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))
    render(<StairDetailView />)

    await waitFor(() => expect(getCardioDataMock).toHaveBeenCalledTimes(1))
    // Give React a tick to settle past the loading branch and into
    // the data-rendered tree before asserting absence.
    await waitFor(() => expect(screen.queryByText(/loading cardio data/i)).not.toBeInTheDocument())
    expect(screen.queryByText(/preview — sample data/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /preview with sample data/i }),
    ).not.toBeInTheDocument()
  })

  it('exits preview by replacing to the bare pathname when the badge button is clicked', async () => {
    getCardioDataMock.mockResolvedValueOnce(null)
    searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))
    render(<StairDetailView />)

    const exit = await screen.findByRole('button', { name: /exit preview/i })
    exit.click()
    expect(routerReplaceMock).toHaveBeenCalledWith('/training-facility/gym/stair')
  })

  it('passes the demo fixture to downstream surfaces when in preview mode', async () => {
    // Sanity check: preview mode means the badge appears AND the
    // fixture's stair sessions ought to flow through. We can't easily
    // inspect the chart children (they're mocked), so verify the
    // fixture has stair sessions to thread (regression: if the fixture
    // ever loses stair entries the demo would render empty).
    expect(CARDIO_DEMO_DATA.sessions.some((s) => s.activity === 'stair')).toBe(true)
  })
})
