import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import type { CardioSession } from '@/types/cardio'

import { WorkoutHeatmap } from './WorkoutHeatmap'

function session(
  dateStr: string,
  activity: CardioSession['activity'] = 'stair',
): Pick<CardioSession, 'date' | 'activity'> {
  return { date: `${dateStr}T08:00:00`, activity }
}

/**
 * Render coverage for `WorkoutHeatmap`. Asserts:
 *   1. The SVG mounts with the expected accessible role/label.
 *   2. The grid contains 7 × N cells matching the helper's grid.
 *   3. Active cells get an intensity color from the rim-orange family
 *      (verifies the helper-result → fill-color wiring; the bucket math
 *      itself is covered in `heatmap-grid.test.ts`).
 *   4. Cell tooltips describe the date and any sessions on it.
 */
describe('WorkoutHeatmap', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an SVG with the expected aria-label', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { getByRole } = render(<WorkoutHeatmap sessions={[]} />)
    const svg = getByRole('img', { name: 'Workout frequency heatmap' })
    expect(svg).toBeInTheDocument()
  })

  it('renders 7 × N cells inside the grid', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1) // Apr 1
    const to = new Date(2026, 3, 15) // Apr 15
    const { container } = render(<WorkoutHeatmap sessions={[]} dateFrom={from} dateTo={to} />)
    // The 4 legend swatches share the same <rect> shape; 4 of the rects in
    // the SVG come from the legend, the rest are grid cells. Subtracting
    // the legend swatch count yields 7 × N for the grid.
    const rects = container.querySelectorAll('svg rect')
    const gridCells = rects.length - 4
    expect(gridCells % 7).toBe(0)
    const cols = gridCells / 7
    expect(cols).toBeGreaterThanOrEqual(3)
    expect(cols).toBeLessThanOrEqual(4)
  })

  it('paints active cells with a rim-orange shade', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1)
    const to = new Date(2026, 3, 15)
    const { container } = render(
      <WorkoutHeatmap sessions={[session('2026-04-14')]} dateFrom={from} dateTo={to} />,
    )
    // At least one rect should reference the rim-orange palette (either the
    // full hex or the rgba family).
    const rects = Array.from(container.querySelectorAll('svg rect'))
    const fills = rects.map((r) => r.getAttribute('fill') ?? '')
    expect(fills.some((f) => /234, 88, 12|EA580C/i.test(f))).toBe(true)
  })

  it('positions the legend strip flush with the SVG right edge at MAX_CELL_SIZE', () => {
    // Regression for #190 item 2 — the original hardcoded `140` offset
    // clipped the legend off the right edge once the responsive scaling
    // pushed cells up to `MAX_CELL_SIZE` (28). The PR fix derives
    // `legendWidth` from the cell stride; this test pins that contract
    // so a future cell-size knob can't silently re-introduce the clip.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { container } = render(<WorkoutHeatmap sessions={[]} cellSize={28} />)
    const svg = container.querySelector('svg')!
    const [, , svgWidth] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number)
    // The legend `<g>` is the only one whose transform x is computed as
    // `DAY_LABEL_WIDTH + gridWidth - legendWidth`. Pick it out by finding
    // the group containing the "More" text.
    const legendGroup = Array.from(container.querySelectorAll('svg g')).find((g) =>
      Array.from(g.querySelectorAll('text')).some((t) => t.textContent === 'More'),
    )
    expect(legendGroup).toBeDefined()
    const transform = legendGroup!.getAttribute('transform') ?? ''
    const match = transform.match(/translate\(([0-9.-]+),\s*([0-9.-]+)\)/)
    expect(match).not.toBeNull()
    const legendX = Number(match![1])
    // Legend width derives from the same constants `WorkoutHeatmap.tsx`
    // uses: 32 (Less text) + 4 swatches at `cellSize + 1` stride + 4
    // (gap) + 28 (More text). At cellSize=28, that's 32 + 116 + 4 + 28 = 180.
    const legendWidth = 32 + 4 * (28 + 1) + 4 + 28
    expect(legendX + legendWidth).toBeLessThanOrEqual(svgWidth)
    expect(legendX).toBeGreaterThan(0)
  })

  it('writes a session-count tooltip on populated cells', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1)
    const to = new Date(2026, 3, 15)
    const { container } = render(
      <WorkoutHeatmap
        sessions={[session('2026-04-14', 'running'), session('2026-04-14', 'walking')]}
        dateFrom={from}
        dateTo={to}
      />,
    )
    const titles = Array.from(container.querySelectorAll('svg rect title')).map(
      (n) => n.textContent ?? '',
    )
    const populated = titles.find((t) => t.includes('2 sessions'))
    expect(populated).toBeDefined()
    expect(populated).toContain('Running')
    expect(populated).toContain('Walking')
  })
})
