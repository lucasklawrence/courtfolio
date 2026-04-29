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

  it('exposes a single play-jump entry point idle, full per-jump tab order when active', async () => {
    // Idle: only the standing silhouette is focusable — it doubles as the
    // keyboard entry point, labeled to make the affordance explicit.
    const user = userEvent.setup()
    render(<SilhouetteJumpTracker entries={baseEntries} />)
    const idleButtons = screen.getAllByRole('button')
    expect(idleButtons).toHaveLength(1)
    expect(idleButtons[0]).toHaveAccessibleName(/Play jump animation.*Mar 15.*23"/)

    // Activating the panel hides the standing button (aria-hidden) and
    // reveals the per-jump silhouettes — one focusable button per entry.
    await user.hover(idleButtons[0])
    expect(screen.getAllByRole('button')).toHaveLength(baseEntries.length)
  })

  it('exposes a per-jump aria-label with vertical and bodyweight (active)', async () => {
    const user = userEvent.setup()
    render(<SilhouetteJumpTracker entries={baseEntries} />)
    // Activate the panel so the per-jump silhouettes enter the a11y tree.
    await user.hover(screen.getByRole('button'))
    const button = screen.getByRole('button', {
      name: /2026-03-15.*Vertical: 23".*Bodyweight: 232 lbs/,
    })
    expect(button).toBeInTheDocument()
  })

  it('omits bodyweight from the label when not logged that month', async () => {
    const user = userEvent.setup()
    const entries: Benchmark[] = [{ date: '2026-04-15', vertical_in: 22 }]
    render(<SilhouetteJumpTracker entries={entries} />)
    // Activate to surface the jump silhouette in the a11y tree.
    await user.hover(screen.getByRole('button'))
    const jumpButton = screen.getByRole('button', { name: /2026-04-15.*Vertical: 22"/ })
    expect(jumpButton.getAttribute('aria-label') ?? '').not.toMatch(/Bodyweight/)
  })

  it('shows the hover tooltip after a user hovers the latest jump silhouette', async () => {
    const user = userEvent.setup()
    render(<SilhouetteJumpTracker entries={baseEntries} />)
    // First hover activates the panel via the standing silhouette.
    await user.hover(screen.getByRole('button'))
    // Then hover the latest jump silhouette to surface its tooltip.
    const latestButton = screen.getByRole('button', { name: /2026-03-15/ })
    await user.hover(latestButton)
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('2026-03-15')
    expect(tooltip).toHaveTextContent('23"')
    expect(tooltip).toHaveTextContent('232 lbs')
  })

  it('drops incomplete sessions before rendering buttons', async () => {
    const user = userEvent.setup()
    const entries: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 19 },
      { date: '2026-02-15', vertical_in: 99, is_complete: false },
      { date: '2026-03-15', vertical_in: 23 },
    ]
    render(<SilhouetteJumpTracker entries={entries} />)
    // Latest is the 23" entry — the dropped 99 never appears anywhere.
    expect(screen.getByRole('button')).toHaveAccessibleName(/Mar 15.*23"/)
    expect(screen.queryByText(/99/)).not.toBeInTheDocument()

    // Active panel reveals one button per complete entry only.
    await user.hover(screen.getByRole('button'))
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: /2026-02-15/ }),
    ).not.toBeInTheDocument()
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
