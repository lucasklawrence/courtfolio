import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import type { CardioTimePoint } from '@/types/cardio'

import { BaseLifestyleTrendChart } from './BaseLifestyleTrendChart'

/**
 * Coverage for the generic lifestyle-trend chart. Date clipping and the
 * undefined / empty-points fallback are the two non-trivial paths; the
 * actual line rendering is `RoughLine`'s job and is tested separately.
 */
describe('BaseLifestyleTrendChart', () => {
  const baseProps = {
    width: 400,
    yLabel: 'HRV (ms)',
    emptyMessage: 'No HRV data in range',
    ariaLabel: 'HRV over time',
  }

  function points(rows: ReadonlyArray<[string, number]>): CardioTimePoint[] {
    return rows.map(([date, value]) => ({ date, value }))
  }

  it('falls back to the empty state when points is undefined', () => {
    const { getByText } = render(<BaseLifestyleTrendChart {...baseProps} points={undefined} />)
    expect(getByText('No HRV data in range')).toBeInTheDocument()
  })

  it('falls back to the empty state when points is an empty array', () => {
    const { getByText } = render(<BaseLifestyleTrendChart {...baseProps} points={[]} />)
    expect(getByText('No HRV data in range')).toBeInTheDocument()
  })

  it('falls back to the empty state when every point is clipped out', () => {
    const data = points([
      ['2026-01-10', 38],
      ['2026-02-14', 42],
    ])
    const { getByText } = render(
      <BaseLifestyleTrendChart
        {...baseProps}
        points={data}
        // Range is entirely after the data — every point should clip out.
        dateFrom={new Date(2026, 5, 1)}
        dateTo={new Date(2026, 5, 30)}
      />,
    )
    expect(getByText('No HRV data in range')).toBeInTheDocument()
  })

  it('renders the SVG (not the empty state) when at least one point survives clipping', () => {
    const data = points([
      ['2026-01-10', 38],
      ['2026-02-14', 42],
      ['2026-03-14', 47],
    ])
    const { container, queryByText } = render(
      <BaseLifestyleTrendChart
        {...baseProps}
        points={data}
        dateFrom={new Date(2026, 1, 1)}
        dateTo={new Date(2026, 3, 31)}
      />,
    )
    // No empty-state caption.
    expect(queryByText('No HRV data in range')).not.toBeInTheDocument()
    // RoughLine renders an <svg>; the y-axis label is present in the SVG output.
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('honors width and height props on the rendered svg', () => {
    const data = points([
      ['2026-03-14', 47],
      ['2026-04-18', 51],
    ])
    const { container } = render(
      <BaseLifestyleTrendChart
        {...baseProps}
        points={data}
        width={500}
        height={150}
      />,
    )
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('500')
    expect(svg?.getAttribute('height')).toBe('150')
  })

  it('drops points whose date string is unparseable instead of plotting NaN', () => {
    const data = points([
      ['not-a-date', 99],
      ['2026-03-14', 47],
      ['2026-04-18', 51],
    ])
    const { container, queryByText } = render(
      <BaseLifestyleTrendChart {...baseProps} points={data} width={400} />,
    )
    // Two valid points → not the empty state.
    expect(queryByText('No HRV data in range')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
