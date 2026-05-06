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
