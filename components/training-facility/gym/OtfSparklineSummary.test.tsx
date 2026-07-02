import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { OtfTrendPoint } from '@/lib/training-facility/otf'

import { OtfSparklineSummary, type OtfSparklineRow } from './OtfSparklineSummary'

/**
 * The sparkline summary (#266) is mostly the shared RoughSparkline plus the
 * `first → latest` value labels and the "no data" fallback. Sparkline geometry
 * is covered by the primitives tests, so these assert the row labels and the
 * value text this component owns.
 */

const pt = (day: number, value: number): OtfTrendPoint => ({ date: new Date(2026, 5, day), value })

function mkRow(overrides: Partial<OtfSparklineRow> = {}): OtfSparklineRow {
  return {
    key: 'distance',
    label: 'Distance',
    trend: [pt(1, 2100), pt(2, 2620)],
    format: v => `${Math.round(v)} m`,
    ...overrides,
  }
}

describe('OtfSparklineSummary', () => {
  it('renders each row label and its first → latest value range', () => {
    render(<OtfSparklineSummary rows={[mkRow()]} ariaLabelPrefix="Rower" />)
    expect(screen.getByText('Distance')).toBeInTheDocument()
    expect(screen.getByText('2100 m → 2620 m')).toBeInTheDocument()
  })

  it('collapses to a single value when first === last', () => {
    render(<OtfSparklineSummary rows={[mkRow({ trend: [pt(1, 2200)] })]} ariaLabelPrefix="Rower" />)
    expect(screen.getByText('2200 m')).toBeInTheDocument()
  })

  it('shows "no data" (and no sparkline) for an empty-trend row', () => {
    render(
      <OtfSparklineSummary
        rows={[mkRow({ key: 'watts', label: 'Avg watts', trend: [] })]}
        ariaLabelPrefix="Rower"
      />
    )
    expect(screen.getByText('Avg watts')).toBeInTheDocument()
    expect(screen.getByText('no data')).toBeInTheDocument()
    // No sparkline graphic is rendered for the empty row.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('gives each sparkline an accessible name prefixed by the machine', () => {
    render(<OtfSparklineSummary rows={[mkRow()]} ariaLabelPrefix="Rower" />)
    expect(
      screen.getByRole('img', { name: 'Rower distance trend, 2100 m → 2620 m' })
    ).toBeInTheDocument()
  })
})
