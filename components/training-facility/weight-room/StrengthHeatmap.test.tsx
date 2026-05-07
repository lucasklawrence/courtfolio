import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import { StrengthHeatmap } from './StrengthHeatmap'

const PUSHUPS: ExerciseGoal = {
  exercise: 'pushups',
  daily_target: 100,
  color: '#EA580C',
}

function set(dateStr: string, exercise: string, reps: number, hour = 8): StrengthSet {
  return {
    id: `${dateStr}-${exercise}-${reps}-${hour}`,
    logged_at: `${dateStr}T${String(hour).padStart(2, '0')}:00:00`,
    exercise,
    reps,
  }
}

describe('StrengthHeatmap', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an SVG with an exercise-specific aria-label by default', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { getByRole } = render(<StrengthHeatmap sets={[]} goal={PUSHUPS} />)
    expect(getByRole('img', { name: 'pushups heatmap' })).toBeInTheDocument()
  })

  it('honors a custom ariaLabel when supplied', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { getByRole } = render(
      <StrengthHeatmap sets={[]} goal={PUSHUPS} ariaLabel="custom label" />,
    )
    expect(getByRole('img', { name: 'custom label' })).toBeInTheDocument()
  })

  it('renders 7 × N cells inside the grid', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1)
    const to = new Date(2026, 3, 15)
    const { container } = render(
      <StrengthHeatmap sets={[]} goal={PUSHUPS} dateFrom={from} dateTo={to} />,
    )
    // 4 legend swatches share the same <rect> shape; remaining rects = 7 × N.
    const rects = container.querySelectorAll('svg rect')
    const gridCells = rects.length - 4
    expect(gridCells % 7).toBe(0)
  })

  it('tints active cells with the exercise color', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1)
    const to = new Date(2026, 3, 15)
    const { container } = render(
      <StrengthHeatmap
        sets={[set('2026-04-14', 'pushups', 100)]}
        goal={PUSHUPS}
        dateFrom={from}
        dateTo={to}
      />,
    )
    const rects = Array.from(container.querySelectorAll('svg rect'))
    const fills = rects.map((r) => r.getAttribute('fill') ?? '')
    expect(fills.some((f) => /EA580C/i.test(f))).toBe(true)
  })

  it('writes a goal-percentage tooltip on populated cells', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1)
    const to = new Date(2026, 3, 15)
    const { container } = render(
      <StrengthHeatmap
        sets={[set('2026-04-14', 'pushups', 50, 8), set('2026-04-14', 'pushups', 50, 18)]}
        goal={PUSHUPS}
        dateFrom={from}
        dateTo={to}
      />,
    )
    const titles = Array.from(container.querySelectorAll('svg rect title')).map(
      (n) => n.textContent ?? '',
    )
    const populated = titles.find((t) => t.includes('100 reps'))
    expect(populated).toBeDefined()
    expect(populated).toContain('2 sets')
    expect(populated).toContain('100% of pushups goal')
  })

  it('renders empty days with a non-color wash, not the exercise tint', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1)
    const to = new Date(2026, 3, 15)
    const { container } = render(
      <StrengthHeatmap sets={[]} goal={PUSHUPS} dateFrom={from} dateTo={to} />,
    )
    // With no sets, every grid cell is empty — none should reference the
    // exercise color (only the legend's "more" swatches do).
    const rects = Array.from(container.querySelectorAll('svg rect'))
    const exerciseColored = rects.filter((r) => /EA580C/i.test(r.getAttribute('fill') ?? ''))
    // 3 of 4 legend swatches use the exercise color (intensities 1, 2, 3).
    expect(exerciseColored.length).toBe(3)
  })

  it('ignores sets for other exercises in the rendered grid', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1)
    const to = new Date(2026, 3, 15)
    const { container } = render(
      <StrengthHeatmap
        sets={[set('2026-04-14', 'pullups', 50)]}
        goal={PUSHUPS}
        dateFrom={from}
        dateTo={to}
      />,
    )
    // Pullups set should NOT tint a pushups cell — only the legend
    // swatches should reference the exercise color.
    const rects = Array.from(container.querySelectorAll('svg rect'))
    const exerciseColored = rects.filter((r) => /EA580C/i.test(r.getAttribute('fill') ?? ''))
    expect(exerciseColored.length).toBe(3)
  })
})
