import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { OtfTrendPoint } from '@/lib/training-facility/otf'

import { OtfCombinedTrendChart, type OtfCombinedSeries } from './OtfCombinedTrendChart'

/**
 * The combined machine chart (#266) is mostly the shared RoughMultiLine plus a
 * legend that re-surfaces the absolute ranges normalization throws away. The
 * chart geometry is exercised by the primitives tests, so these assert the
 * legend text — the part unique to this component.
 */

const pt = (day: number, value: number): OtfTrendPoint => ({ date: new Date(2026, 5, day), value })

function mkSeries(overrides: Partial<OtfCombinedSeries> = {}): OtfCombinedSeries {
  return {
    key: 'distance',
    label: 'Distance',
    color: '#ea580c',
    trend: [pt(1, 100), pt(2, 200)],
    format: v => `${Math.round(v)} m`,
    ...overrides,
  }
}

describe('OtfCombinedTrendChart', () => {
  it('renders a legend range (min → max) for a series with a spread', () => {
    render(
      <OtfCombinedTrendChart
        series={[mkSeries()]}
        width={400}
        ariaLabel="rower combined"
        emptyMessage="No rower data in range"
      />
    )
    expect(screen.getByText('Distance')).toBeInTheDocument()
    expect(screen.getByText('100 m → 200 m')).toBeInTheDocument()
  })

  it('shows a single formatted value when the series is flat / one class', () => {
    render(
      <OtfCombinedTrendChart
        series={[mkSeries({ trend: [pt(1, 150)] })]}
        width={400}
        ariaLabel="rower combined"
        emptyMessage="No rower data in range"
      />
    )
    expect(screen.getByText('150 m')).toBeInTheDocument()
  })

  it('labels an absent metric as "no data" instead of a range', () => {
    render(
      <OtfCombinedTrendChart
        series={[mkSeries({ key: 'watts', label: 'Avg watts', trend: [] })]}
        width={400}
        ariaLabel="rower combined"
        emptyMessage="No rower data in range"
      />
    )
    expect(screen.getByText('Avg watts')).toBeInTheDocument()
    expect(screen.getByText('no data')).toBeInTheDocument()
  })

  it('falls back to the empty chart when no series has data', () => {
    render(
      <OtfCombinedTrendChart
        series={[mkSeries({ trend: [] })]}
        width={400}
        ariaLabel="rower combined"
        emptyMessage="No rower data in range"
      />
    )
    expect(screen.getByText('No rower data in range')).toBeInTheDocument()
  })
})
