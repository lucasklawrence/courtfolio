import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Benchmark } from '@/types/movement'
import { CeilingView } from './CeilingView'

describe('CeilingView', () => {
  it('renders an empty state when no jumps are logged', () => {
    render(<CeilingView entries={[]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/no jumps logged yet/i)).toBeInTheDocument()
  })

  it('renders the inches-to-rim annotation when below the rim', () => {
    const entries: Benchmark[] = [{ date: '2026-04-15', vertical_in: 22 }]
    // jump-touch = 80 + 22 = 102, gap = 18.
    // The string appears twice — once inside the SVG label, once in the
    // static caption below — so getAllByText is expected.
    render(<CeilingView entries={entries} standingReachIn={80} rimHeightIn={120} />)
    expect(screen.getAllByText(/18"\s*to rim/i).length).toBeGreaterThanOrEqual(1)
  })

  it('reports the latest jump-touch in the static caption', () => {
    const entries: Benchmark[] = [{ date: '2026-04-15', vertical_in: 22 }]
    render(<CeilingView entries={entries} standingReachIn={80} />)
    // The caption is the one paragraph rendered outside the SVG.
    const caption = screen.getByText(/jump-touch · 102"/i)
    expect(caption).toBeInTheDocument()
    expect(caption).toHaveTextContent('18" to rim')
  })

  it('swaps to the milestone state when jump-touch reaches the rim', () => {
    const entries: Benchmark[] = [{ date: '2026-04-15', vertical_in: 40 }]
    // jump-touch = 80 + 40 = 120 = rim
    render(<CeilingView entries={entries} standingReachIn={80} rimHeightIn={120} />)
    expect(screen.getByText(/RIM TOUCH/i)).toBeInTheDocument()
    expect(screen.getByText(/rim reached/i)).toBeInTheDocument()
    expect(screen.queryByText(/to rim/i)).not.toBeInTheDocument()
  })

  it('uses the latest entry (not the highest) for the bar height', () => {
    const entries: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 25 }, // higher, but older
      { date: '2026-04-15', vertical_in: 20 }, // newer, but lower
    ]
    render(<CeilingView entries={entries} standingReachIn={80} rimHeightIn={120} />)
    // Latest = 20 → jump-touch = 100, gap = 20. Asserted via the caption,
    // which carries the same numbers as the SVG annotation.
    const caption = screen.getByText(/jump-touch · 100"/i)
    expect(caption).toHaveTextContent('20" to rim')
  })

  it('honors the override aria-label', () => {
    const entries: Benchmark[] = [{ date: '2026-04-15', vertical_in: 22 }]
    render(<CeilingView entries={entries} ariaLabel="Custom rim gauge label" />)
    expect(screen.getByRole('img', { name: 'Custom rim gauge label' })).toBeInTheDocument()
  })

  it('drops incomplete sessions when picking the latest', () => {
    const entries: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 20 },
      { date: '2026-04-15', vertical_in: 99, is_complete: false }, // dropped
    ]
    render(<CeilingView entries={entries} standingReachIn={80} rimHeightIn={120} />)
    // Latest valid = 20 → jump-touch = 100, gap = 20. Caption mirrors the
    // SVG annotation, so checking it covers both rendering surfaces.
    const caption = screen.getByText(/jump-touch · 100"/i)
    expect(caption).toHaveTextContent('20" to rim')
    expect(screen.queryByText(/RIM TOUCH/i)).not.toBeInTheDocument()
  })
})
