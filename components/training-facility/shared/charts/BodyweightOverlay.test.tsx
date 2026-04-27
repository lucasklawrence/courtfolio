import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Benchmark } from '@/types/movement'
import { BodyweightOverlay } from './BodyweightOverlay'

/**
 * Render coverage for the BodyweightOverlay wrapper. We can't assert on
 * rough.js path geometry (intentionally non-deterministic between SSR and
 * client), but we can verify the visible structure and the toggle UX.
 *
 * The overlay layer mounts inside a `useEffect` to sidestep an SSR
 * hydration mismatch with the shared rough.js generator (see the function
 * JSDoc). RTL flushes effects synchronously, so by the time `render()`
 * resolves the post-hydration layer is in the DOM and we can query it.
 */

const benchmarks: Benchmark[] = [
  { date: '2026-01-15', bodyweight_lbs: 240, vertical_in: 19 },
  { date: '2026-02-15', bodyweight_lbs: 236, vertical_in: 20 },
  { date: '2026-03-15', bodyweight_lbs: 233, vertical_in: 21 },
  { date: '2026-04-15', bodyweight_lbs: 230, vertical_in: 22 },
]

const dateExtent: [Date, Date] = [
  new Date(benchmarks[0].date),
  new Date(benchmarks[benchmarks.length - 1].date),
]

function ChildPlaceholder(): React.JSX.Element {
  return <div data-testid="primary-chart" style={{ width: 400, height: 200 }} />
}

describe('BodyweightOverlay render', () => {
  it('mounts the overlay layer after hydration with default props', () => {
    render(
      <BodyweightOverlay benchmarks={benchmarks} dateExtent={dateExtent} width={400} height={200}>
        <ChildPlaceholder />
      </BodyweightOverlay>,
    )
    // Toggle button is visible immediately and accessible.
    expect(screen.getByRole('button', { name: /Toggle Bodyweight overlay/ })).toBeInTheDocument()
    // Post-hydration the overlay SVG layer is present with the default ariaLabel.
    expect(screen.getByRole('img', { name: 'Bodyweight overlay' })).toBeInTheDocument()
    // Children are still rendered alongside the overlay.
    expect(screen.getByTestId('primary-chart')).toBeInTheDocument()
  })

  it('accepts a custom ariaLabel + axisLabel + toggleLabel', () => {
    render(
      <BodyweightOverlay
        benchmarks={benchmarks}
        dateExtent={dateExtent}
        width={400}
        height={200}
        ariaLabel="Custom overlay label"
        axisLabel="Weight (kg)"
        toggleLabel="Weight"
      >
        <ChildPlaceholder />
      </BodyweightOverlay>,
    )
    expect(screen.getByRole('img', { name: 'Custom overlay label' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Toggle Weight overlay/ })).toBeInTheDocument()
    // The right-axis label text appears inside the SVG.
    expect(screen.getByText('Weight (kg)')).toBeInTheDocument()
  })

  it('clicking the toggle hides the overlay layer (uncontrolled mode)', async () => {
    const user = userEvent.setup()
    render(
      <BodyweightOverlay benchmarks={benchmarks} dateExtent={dateExtent} width={400} height={200}>
        <ChildPlaceholder />
      </BodyweightOverlay>,
    )

    const toggle = screen.getByRole('button', { name: /Toggle Bodyweight overlay/ })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'Bodyweight overlay' })).toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('img', { name: 'Bodyweight overlay' })).not.toBeInTheDocument()
  })

  it('controlled mode: enabled prop drives visibility, onEnabledChange fires on click', async () => {
    const onEnabledChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <BodyweightOverlay
        benchmarks={benchmarks}
        dateExtent={dateExtent}
        width={400}
        height={200}
        enabled={true}
        onEnabledChange={onEnabledChange}
      >
        <ChildPlaceholder />
      </BodyweightOverlay>,
    )

    expect(screen.getByRole('img', { name: 'Bodyweight overlay' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Toggle Bodyweight overlay/ }))
    // Controlled toggle does not flip internal state — parent decides.
    expect(onEnabledChange).toHaveBeenCalledWith(false)
    // Layer still visible because parent didn't update `enabled`.
    expect(screen.getByRole('img', { name: 'Bodyweight overlay' })).toBeInTheDocument()

    // Parent flips the prop; layer should disappear.
    rerender(
      <BodyweightOverlay
        benchmarks={benchmarks}
        dateExtent={dateExtent}
        width={400}
        height={200}
        enabled={false}
        onEnabledChange={onEnabledChange}
      >
        <ChildPlaceholder />
      </BodyweightOverlay>,
    )
    expect(screen.queryByRole('img', { name: 'Bodyweight overlay' })).not.toBeInTheDocument()
  })

  it('disables the toggle button and skips the layer when there are no bodyweight points', () => {
    const noBw: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 19 }, // no bodyweight_lbs
    ]
    render(
      <BodyweightOverlay
        benchmarks={noBw}
        dateExtent={[new Date('2026-01-15'), new Date('2026-04-15')]}
        width={400}
        height={200}
      >
        <ChildPlaceholder />
      </BodyweightOverlay>,
    )
    const toggle = screen.getByRole('button', { name: /Toggle Bodyweight overlay/ })
    expect(toggle).toBeDisabled()
    expect(screen.queryByRole('img', { name: 'Bodyweight overlay' })).not.toBeInTheDocument()
  })

  it('clamps points outside dateExtent so they do not drive the y-scale or render', () => {
    // Tight extent: only Feb–Mar. Jan and Apr should be excluded.
    render(
      <BodyweightOverlay
        benchmarks={benchmarks}
        dateExtent={[new Date('2026-02-01'), new Date('2026-03-31')]}
        width={400}
        height={200}
      >
        <ChildPlaceholder />
      </BodyweightOverlay>,
    )
    // Layer still renders for the in-range points; just verifying no crash
    // and the toggle stays enabled.
    const toggle = screen.getByRole('button', { name: /Toggle Bodyweight overlay/ })
    expect(toggle).not.toBeDisabled()
    expect(screen.getByRole('img', { name: 'Bodyweight overlay' })).toBeInTheDocument()
  })

  it('skips entries with is_complete=false', () => {
    const allIncomplete: Benchmark[] = [
      { date: '2026-01-15', bodyweight_lbs: 240, is_complete: false },
      { date: '2026-04-15', bodyweight_lbs: 230, is_complete: false },
    ]
    render(
      <BodyweightOverlay
        benchmarks={allIncomplete}
        dateExtent={dateExtent}
        width={400}
        height={200}
      >
        <ChildPlaceholder />
      </BodyweightOverlay>,
    )
    // No usable points → toggle disabled, no layer.
    expect(screen.getByRole('button', { name: /Toggle Bodyweight overlay/ })).toBeDisabled()
    expect(screen.queryByRole('img', { name: 'Bodyweight overlay' })).not.toBeInTheDocument()
  })
})
