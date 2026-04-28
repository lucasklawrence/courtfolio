import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Benchmark } from '@/types/movement'
import { SilhouetteJumpTracker } from './SilhouetteJumpTracker'

const baseEntries: Benchmark[] = [
  { date: '2026-01-15', vertical_in: 19, bodyweight_lbs: 240 },
  { date: '2026-02-15', vertical_in: 21, bodyweight_lbs: 235 },
  { date: '2026-03-15', vertical_in: 23, bodyweight_lbs: 232 },
]

describe('SilhouetteJumpTracker', () => {
  it('renders an empty state when there are no jump entries', () => {
    render(<SilhouetteJumpTracker entries={[]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(
      screen.getByText(/no jumps logged yet/i),
    ).toBeInTheDocument()
  })

  it('renders the standing-reach annotation with the configured reach', () => {
    render(<SilhouetteJumpTracker entries={baseEntries} standingReachIn={82} />)
    expect(screen.getByText(/standing reach/i)).toHaveTextContent('82"')
  })

  it('labels the latest jump with date and inches', () => {
    render(<SilhouetteJumpTracker entries={baseEntries} />)
    // Latest entry is 2026-03-15 → "Mar 15 · 23""
    expect(screen.getByText(/Mar 15.*23/)).toBeInTheDocument()
  })

  it('renders one focusable silhouette button per jump entry', () => {
    render(<SilhouetteJumpTracker entries={baseEntries} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(baseEntries.length)
  })

  it('exposes a per-jump aria-label with vertical and bodyweight', () => {
    render(<SilhouetteJumpTracker entries={baseEntries} />)
    const button = screen.getByRole('button', {
      name: /2026-03-15.*Vertical: 23".*Bodyweight: 232 lbs/,
    })
    expect(button).toBeInTheDocument()
  })

  it('omits bodyweight from the label when not logged that month', () => {
    const entries: Benchmark[] = [{ date: '2026-04-15', vertical_in: 22 }]
    render(<SilhouetteJumpTracker entries={entries} />)
    expect(
      screen.getByRole('button', { name: /2026-04-15.*Vertical: 22"/ }),
    ).toBeInTheDocument()
    // No bodyweight token should appear in the accessible name.
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label') ?? '').not.toMatch(/Bodyweight/)
  })

  it('shows the hover tooltip after a user hovers a silhouette', async () => {
    const user = userEvent.setup()
    render(<SilhouetteJumpTracker entries={baseEntries} />)
    const latestButton = screen.getByRole('button', { name: /2026-03-15/ })
    await user.hover(latestButton)
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('2026-03-15')
    expect(tooltip).toHaveTextContent('23"')
    expect(tooltip).toHaveTextContent('232 lbs')
  })

  it('drops incomplete sessions before rendering buttons', () => {
    const entries: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 19 },
      { date: '2026-02-15', vertical_in: 99, is_complete: false },
      { date: '2026-03-15', vertical_in: 23 },
    ]
    render(<SilhouetteJumpTracker entries={entries} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    // Latest visible label should reference the 23" entry, not the dropped 99.
    expect(screen.getByText(/Mar 15.*23/)).toBeInTheDocument()
    expect(screen.queryByText(/99/)).not.toBeInTheDocument()
  })

  it('sizes the viewBox to fit the peak historical jump, even when the latest is a regression', () => {
    // Earlier session is a peak (35"), later session regresses (20"). The
    // viewBox + y-axis must accommodate the peak silhouette so it doesn't clip.
    const entries: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 35 },
      { date: '2026-04-15', vertical_in: 20 },
    ]
    const { container } = render(
      <SilhouetteJumpTracker entries={entries} standingReachIn={80} />,
    )
    const svg = container.querySelector('svg')
    const viewBox = svg?.getAttribute('viewBox') ?? ''
    // peakJumpTouch = 80 + 35 = 115; + 12" headroom → 127. Anything below
    // 115 would have clipped the prior peak silhouette's fingertip.
    const height = Number(viewBox.split(' ')[3])
    expect(height).toBeGreaterThanOrEqual(115 + 12)
    // Y-axis should also extend to at least the peak vertical, ticking every 6".
    expect(screen.getByText('+36"')).toBeInTheDocument()
  })

  it('uses the override aria-label when one is provided', () => {
    render(
      <SilhouetteJumpTracker
        entries={baseEntries}
        ariaLabel="Custom tracker label"
      />,
    )
    expect(
      screen.getByRole('img', { name: 'Custom tracker label' }),
    ).toBeInTheDocument()
  })
})
