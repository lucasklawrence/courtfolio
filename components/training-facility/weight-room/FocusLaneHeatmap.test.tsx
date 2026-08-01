import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import type { FocusDayCell } from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'

import { FocusLaneHeatmap } from './FocusLaneHeatmap'

const SHRUGS: MonthlyFocus = {
  id: 'focus-shrugs',
  exercise: 'shrugs',
  daily_target: 50,
  target_kind: 'reps',
  color: '#C9A268',
  category: 'upper',
  start_date: '2026-06-29',
  end_date: '2026-08-02',
}

const DIPS: MonthlyFocus = {
  ...SHRUGS,
  id: 'focus-dips',
  exercise: 'dips',
  color: '#EA580C',
  start_date: '2026-08-03',
  end_date: '2026-09-06',
}

/** Build a contiguous run of cells starting at `from`, all on `focus`. */
function lane(from: string, days: number, focus: MonthlyFocus | null): FocusDayCell[] {
  const start = new Date(from + 'T12:00:00')
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12)
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    return { dayKey, focus, volume: focus === null ? 0 : 50, pct: focus === null ? 0 : 1 }
  })
}

/** Parse the `viewBox` into `[width, height]`. */
function viewBox(container: HTMLElement): [number, number] {
  const raw = container.querySelector('svg')?.getAttribute('viewBox') ?? ''
  const [, , w, h] = raw.split(' ').map(Number)
  return [w, h]
}

/** Rendered month labels, in document order. */
function monthLabels(container: HTMLElement): string[] {
  const g = container.querySelector('svg > g')
  return Array.from(g?.querySelectorAll('text') ?? []).map((t) => t.textContent ?? '')
}

/** X offsets of the rendered month labels, in document order. */
function monthLabelXs(container: HTMLElement): number[] {
  const g = container.querySelector('svg > g')
  return Array.from(g?.querySelectorAll('text') ?? []).map((t) => Number(t.getAttribute('x')))
}

/**
 * Advance width of a three-glyph month name at 11px — the distance two
 * labels must clear to avoid rendering as one word.
 */
const GLYPH_WIDTH_3 = 3 * 11 * 0.6

describe('FocusLaneHeatmap', () => {
  it('renders nothing when the lane has no cells', () => {
    const { container } = render(<FocusLaneHeatmap cells={[]} label="Upper Focus Lane" />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('exposes the lane label on the SVG', () => {
    const { getByRole } = render(
      <FocusLaneHeatmap cells={lane('2026-06-29', 36, SHRUGS)} label="Upper Focus Lane" />,
    )
    expect(getByRole('img', { name: 'Upper Focus Lane' })).toBeInTheDocument()
  })

  // ---- #370: a short rotation must not render as a postage stamp ----------

  it('scales a short rotation up rather than leaving a 116px chart', () => {
    // One ~5-week rotation — the exact case that rendered 116px wide inside
    // a 902px card at the fixed 14px stride.
    const { container } = render(
      <FocusLaneHeatmap cells={lane('2026-06-29', 36, SHRUGS)} label="Upper Focus Lane" />,
    )
    const [width] = viewBox(container)
    expect(width).toBeGreaterThan(200)
  })

  it('caps the scale-up so cells stay cells', () => {
    // Two weeks is the shortest plausible lane; without a cap the stride
    // would balloon to fill the target width.
    const { container } = render(
      <FocusLaneHeatmap cells={lane('2026-06-29', 14, SHRUGS)} label="Upper Focus Lane" />,
    )
    const [, height] = viewBox(container)
    // 7 rows at the 30px cap, plus the month row and legend strip.
    expect(height).toBeLessThan(7 * 30 + 60)
  })

  it('leaves a long lane at the base stride, matching StrengthHeatmap', () => {
    // A year of rotations is already wider than the target, so nothing is
    // scaled and the lane renders exactly as it does today.
    const cells = lane('2025-08-04', 364, SHRUGS)
    const { container } = render(<FocusLaneHeatmap cells={cells} label="Upper Focus Lane" />)
    const [width] = viewBox(container)
    // 52 columns × 14px + the 32px day-label gutter, plus label overhang.
    expect(width).toBeGreaterThanOrEqual(52 * 14 + 32)
    expect(width).toBeLessThan(52 * 14 + 32 + 40)
  })

  it('honors an explicit cellSize as a floor', () => {
    const cells = lane('2025-08-04', 364, SHRUGS)
    const base = render(<FocusLaneHeatmap cells={cells} label="Upper" />)
    const bigger = render(<FocusLaneHeatmap cells={cells} label="Upper" cellSize={20} />)
    expect(viewBox(bigger.container)[0]).toBeGreaterThan(viewBox(base.container)[0])
  })

  // ---- #370: month labels must not collide or clip -----------------------

  it('does not render two month labels on top of each other', () => {
    // Jun 29 2026 is a Monday, so Jun owns exactly one column and Jul starts
    // in the next one — the "JunJul" repro. On a lane this short the wider
    // stride is what separates them; the thinning rule is the backstop.
    const { container } = render(
      <FocusLaneHeatmap cells={lane('2026-06-29', 36, SHRUGS)} label="Upper Focus Lane" />,
    )
    const xs = monthLabelXs(container)
    expect(xs.length).toBeGreaterThan(1)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(GLYPH_WIDTH_3)
    }
  })

  it('drops a leading month sliver once the lane is long enough to sit at base stride', () => {
    // ~29 weeks renders at the 14px stride, so the same Jun/Jul adjacency
    // can no longer be solved by scaling — the sliver label is dropped.
    const { container } = render(
      <FocusLaneHeatmap cells={lane('2026-06-29', 200, SHRUGS)} label="Upper Focus Lane" />,
    )
    const labels = monthLabels(container)
    expect(labels).not.toContain('Jun')
    expect(labels[0]).toBe('Jul')

    const xs = monthLabelXs(container)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(GLYPH_WIDTH_3)
    }
  })

  it('reserves width for a trailing month label so it is not clipped', () => {
    // "Aug" lands in the final column; the SVG must extend past the grid.
    const cells = lane('2026-06-29', 36, SHRUGS)
    const { container } = render(<FocusLaneHeatmap cells={cells} label="Upper Focus Lane" />)
    const [width] = viewBox(container)

    const g = container.querySelectorAll('svg > g')[0]
    const texts = Array.from(g.querySelectorAll('text'))
    const lastX = Math.max(...texts.map((t) => Number(t.getAttribute('x'))))
    // 32px gutter + the label's own x + room for three glyphs at 11px.
    expect(width).toBeGreaterThanOrEqual(32 + lastX + 3 * 11 * 0.6)
  })

  // ---- #370: legend entries must not overlap -----------------------------

  it('spaces legend entries so their labels cannot overlap', () => {
    // Two rotations stitched into one lane: shrugs then dips.
    const cells = [...lane('2026-06-29', 35, SHRUGS), ...lane('2026-08-03', 35, DIPS)]
    const { container } = render(<FocusLaneHeatmap cells={cells} label="Upper Focus Lane" />)

    const groups = container.querySelectorAll('svg > g')
    const legend = groups[groups.length - 1]
    const entries = Array.from(legend.querySelectorAll('g')).map((g) => {
      const m = /translate\(([-\d.]+), ([-\d.]+)\)/.exec(g.getAttribute('transform') ?? '')
      return { x: Number(m?.[1]), y: Number(m?.[2]) }
    })

    expect(entries).toHaveLength(2)
    // Either stacked on separate rows, or far enough apart on the same row
    // to clear the swatch plus the longest label.
    const [a, b] = entries
    const clears = a.y !== b.y || Math.abs(b.x - a.x) >= 12 + 4 + 'shrugs'.length * 10 * 0.6
    expect(clears).toBe(true)
  })

  it('renders one legend swatch per rotation, not per day', () => {
    const cells = [...lane('2026-06-29', 35, SHRUGS), ...lane('2026-08-03', 35, DIPS)]
    const { getByText } = render(<FocusLaneHeatmap cells={cells} label="Upper Focus Lane" />)
    expect(getByText('shrugs')).toBeInTheDocument()
    expect(getByText('dips')).toBeInTheDocument()
  })

  it('keeps gap days visible as cells with no focus color', () => {
    const cells = [
      ...lane('2026-06-29', 7, SHRUGS),
      ...lane('2026-07-06', 7, null),
      ...lane('2026-07-13', 7, SHRUGS),
    ]
    const { container } = render(<FocusLaneHeatmap cells={cells} label="Upper Focus Lane" />)
    const tinted = container.querySelectorAll(`rect[fill="${SHRUGS.color}"]`)
    // 14 focus days plus one legend swatch.
    expect(tinted.length).toBe(15)
  })
})
