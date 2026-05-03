import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { JumpTrackerSection } from './JumpTrackerSection'

/**
 * Tests for the silhouette + ceiling-view client island. The interesting
 * surface here is the empty-state preview swap (#171): when the URL has
 * `?preview=demo` and the real benchmark fetch settles empty, the island
 * substitutes `COMBINE_DEMO_BENCHMARKS` so the silhouette stack and rim
 * gauge hydrate alongside the rest of the Combine page (which
 * `CombineDataIsland` already wires up via #160).
 *
 * `getMovementBenchmarks` is stubbed at the data layer; `useSearchParams`
 * is stubbed via `next/navigation` so each test controls the preview
 * param independently.
 */

const searchParamsMock = vi.fn<() => URLSearchParams>(() => new URLSearchParams())
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
}))

const getMovementBenchmarksMock = vi.fn()
vi.mock('@/lib/data/movement', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/movement')>(
    '@/lib/data/movement',
  )
  return {
    ...actual,
    getMovementBenchmarks: (...args: unknown[]) => getMovementBenchmarksMock(...args),
  }
})

beforeEach(() => {
  searchParamsMock.mockReset()
  searchParamsMock.mockReturnValue(new URLSearchParams())
  getMovementBenchmarksMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('JumpTrackerSection', () => {
  it('renders both child empty states when the fetch resolves empty and no preview param is set', async () => {
    getMovementBenchmarksMock.mockResolvedValueOnce([])

    render(<JumpTrackerSection />)

    // Both children expose `role="status"` + aria-label "No jump data" in
    // their empty branch; assert we see exactly two of them so neither
    // child silently slipped into a populated render.
    const empties = await screen.findAllByRole('status', { name: /no jump data/i })
    expect(empties).toHaveLength(2)
    expect(getMovementBenchmarksMock).toHaveBeenCalledTimes(1)
  })

  it('hydrates from COMBINE_DEMO_BENCHMARKS when the fetch is empty and ?preview=demo is set', async () => {
    getMovementBenchmarksMock.mockResolvedValueOnce([])
    searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))

    render(<JumpTrackerSection />)

    // Wait for the fetch to settle; the latest fixture row is 2026-05-01
    // with vertical 23" — the silhouette tracker renders a `MMM D · N"`
    // callout for that entry, which is unique to the populated branch.
    await waitFor(() =>
      expect(screen.getByText(/May 1 · 23/)).toBeInTheDocument(),
    )
    // Empty-state copy from either child must be gone — both children
    // are rendering fixture data now.
    expect(screen.queryByRole('status', { name: /no jump data/i })).not.toBeInTheDocument()
  })

  it('ignores ?preview=demo when real entries exist (real data wins)', async () => {
    // Real, non-empty fetch — the island must NOT swap to the demo
    // fixture even though the URL param is present. Mirrors
    // CombineDataIsland's "real data wins" branch.
    getMovementBenchmarksMock.mockResolvedValueOnce([
      { date: '2026-04-15', vertical_in: 22, bodyweight_lbs: 234 },
    ])
    searchParamsMock.mockReturnValue(new URLSearchParams('preview=demo'))

    render(<JumpTrackerSection />)

    // Real entry's date-derived label: "Apr 15 · 22""
    await waitFor(() =>
      expect(screen.getByText(/Apr 15 · 22/)).toBeInTheDocument(),
    )
    // Fixture's latest row should NOT appear.
    expect(screen.queryByText(/May 1 · 23/)).not.toBeInTheDocument()
  })

  it('returns to the empty state when ?preview=demo is removed (param exit)', async () => {
    // Sanity check the inverse of test 2: with a fresh, empty fetch and
    // no preview param, both children render their empty branch. Guards
    // against a future refactor that ties the swap to the wrong gate
    // (e.g. param presence regardless of param value).
    getMovementBenchmarksMock.mockResolvedValueOnce([])
    searchParamsMock.mockReturnValue(new URLSearchParams('preview=other'))

    render(<JumpTrackerSection />)

    const empties = await screen.findAllByRole('status', { name: /no jump data/i })
    expect(empties).toHaveLength(2)
  })
})
