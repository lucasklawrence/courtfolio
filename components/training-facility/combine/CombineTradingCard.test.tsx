import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { Benchmark } from '@/types/movement'
import { CombineTradingCard, pickLatestEntry } from './CombineTradingCard'

/**
 * Smoke coverage for the Combine-page Trading Card wrapper. The
 * underlying {@link TradingCard} has its own exhaustive suite — this
 * file pins the wrapper's contract: undefined / empty / all-incomplete
 * inputs render nothing; populated input renders the card inside an
 * accessibly-labeled section.
 */

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

describe('CombineTradingCard', () => {
  it('renders nothing while the initial fetch is in flight (entries undefined)', () => {
    const { container } = render(<CombineTradingCard entries={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the benchmark history is empty', () => {
    const { container } = render(<CombineTradingCard entries={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when every entry is marked incomplete', () => {
    const { container } = render(
      <CombineTradingCard
        entries={[
          { date: '2026-03-15', vertical_in: 22, is_complete: false },
          { date: '2026-04-10', vertical_in: 23, is_complete: false },
        ]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the TradingCard wrapped in a labeled section once data arrives', () => {
    render(
      <CombineTradingCard
        entries={[
          { date: '2026-01-15', vertical_in: 19 },
          { date: '2026-04-10', vertical_in: 23 },
        ]}
      />,
    )
    const section = screen.getByRole('region', { name: /combine trading card/i })
    expect(section).toBeInTheDocument()
    // TradingCard exposes itself as a button with an aria-label that mentions the season.
    expect(section.querySelector('button[aria-label*="Trading card"]')).not.toBeNull()
  })
})
