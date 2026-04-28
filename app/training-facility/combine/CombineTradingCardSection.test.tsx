import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { Benchmark } from '@/types/movement'
import { CombineTradingCardSection, pickLatestEntry } from './CombineTradingCardSection'

/**
 * Smoke coverage for the Combine Trading Card client island. The TradingCard
 * itself has its own exhaustive suite — this file pins the wiring contract:
 * empty data renders nothing, populated data renders the card with the
 * newest entry as the subject.
 */

vi.mock('@/lib/data/movement', () => ({
  getMovementBenchmarks: vi.fn(),
}))

import { getMovementBenchmarks } from '@/lib/data/movement'
const mockedGet = vi.mocked(getMovementBenchmarks)

beforeEach(() => {
  mockedGet.mockReset()
})

describe('pickLatestEntry', () => {
  it('returns undefined for empty input', () => {
    expect(pickLatestEntry([])).toBeUndefined()
  })

  it('returns the entry with the most recent ISO date regardless of input order', () => {
    const a: Benchmark = { date: '2026-01-15', vertical_in: 19 }
    const b: Benchmark = { date: '2026-04-10', vertical_in: 23 }
    const c: Benchmark = { date: '2026-02-20', vertical_in: 21 }
    expect(pickLatestEntry([a, b, c])).toBe(b)
  })

  it('skips entries with is_complete === false so the card matches the scoreboard', () => {
    const completeOlder: Benchmark = { date: '2026-03-15', vertical_in: 22 }
    const incompleteNewer: Benchmark = { date: '2026-04-10', vertical_in: 23, is_complete: false }
    expect(pickLatestEntry([completeOlder, incompleteNewer])).toBe(completeOlder)
  })

  it('returns undefined when every entry is marked incomplete', () => {
    const onlyIncomplete: Benchmark[] = [
      { date: '2026-03-15', vertical_in: 22, is_complete: false },
      { date: '2026-04-10', vertical_in: 23, is_complete: false },
    ]
    expect(pickLatestEntry(onlyIncomplete)).toBeUndefined()
  })
})

describe('CombineTradingCardSection', () => {
  it('renders nothing when the benchmark history is empty', async () => {
    mockedGet.mockResolvedValue([])
    const { container } = render(<CombineTradingCardSection />)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the fetch rejects', async () => {
    mockedGet.mockRejectedValue(new Error('offline'))
    const { container } = render(<CombineTradingCardSection />)
    await waitFor(() => expect(mockedGet).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('renders the TradingCard wrapped in a labeled section once data arrives', async () => {
    mockedGet.mockResolvedValue([
      { date: '2026-01-15', vertical_in: 19 },
      { date: '2026-04-10', vertical_in: 23 },
    ])
    render(<CombineTradingCardSection />)
    const section = await screen.findByRole('region', { name: /combine trading card/i })
    expect(section).toBeInTheDocument()
    // TradingCard exposes itself as a button with an aria-label that mentions the season.
    expect(section.querySelector('button[aria-label*="Trading card"]')).not.toBeNull()
  })
})
