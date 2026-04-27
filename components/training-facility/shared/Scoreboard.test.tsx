import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Scoreboard, type ScoreboardCell } from './Scoreboard'

/**
 * Render coverage for the `Scoreboard` component. The pure helpers
 * (`classifyDelta`, `deriveCombineScoreboardCells`, etc.) live in
 * `scoreboard-utils.ts` and are tested in `scoreboard-utils.test.ts`;
 * this file exercises the render path — cell layout, value formatting,
 * delta visibility, accessibility plumbing.
 *
 * framer-motion animations are not asserted here (rough.js-style: too
 * fragile, spot-checked on the dev/scoreboard preview). The values that
 * land in the DOM are the ones produced by the static formatters, not
 * the count-up intermediate states.
 */

const baseCell = (overrides: Partial<ScoreboardCell> = {}): ScoreboardCell => ({
  label: 'VERT',
  value: 22,
  baseline: 19.5,
  precision: 1,
  unit: '"',
  direction: 'higher',
  ...overrides,
})

describe('Scoreboard render', () => {
  it('renders a region with the default ariaLabel and one cell per input', () => {
    render(<Scoreboard cells={[baseCell({ label: 'VERT' }), baseCell({ label: '5-10-5' })]} />)
    const region = screen.getByRole('group', { name: 'Scoreboard' })
    expect(region).toBeInTheDocument()
    expect(screen.getByText('VERT')).toBeInTheDocument()
    expect(screen.getByText('5-10-5')).toBeInTheDocument()
  })

  it('honors a custom ariaLabel', () => {
    render(
      <Scoreboard cells={[baseCell()]} ariaLabel="Combine scoreboard summary" />,
    )
    expect(screen.getByRole('group', { name: 'Combine scoreboard summary' })).toBeInTheDocument()
  })

  it('appends caller-supplied className to the outer container', () => {
    const { container } = render(
      <Scoreboard cells={[baseCell()]} className="custom-grid-class" />,
    )
    expect(container.firstElementChild).toHaveClass('custom-grid-class')
  })

  it('renders the value formatted to its precision and the unit beside it', () => {
    render(<Scoreboard cells={[baseCell({ value: 22.0, precision: 1, unit: '"' })]} />)
    // The digits + unit are wrapped in a span whose aria-label combines them
    // for screen readers (the unit is otherwise aria-hidden).
    expect(screen.getByLabelText('22.0 "')).toBeInTheDocument()
  })

  it('renders an em-dash and no unit when the value is undefined', () => {
    render(<Scoreboard cells={[baseCell({ value: undefined })]} />)
    expect(screen.getByLabelText('—')).toBeInTheDocument()
  })

  it('shows a delta line when value and baseline produce a non-zero rounded delta', () => {
    render(
      <Scoreboard
        cells={[baseCell({ value: 22, baseline: 19.5, precision: 1, unit: '"', direction: 'higher' })]}
      />,
    )
    // delta = +2.5" — improvement (higher direction).
    expect(screen.getByLabelText(/Delta .* versus baseline/)).toBeInTheDocument()
  })

  it('hides the delta line when baseline is missing', () => {
    render(<Scoreboard cells={[baseCell({ baseline: undefined })]} />)
    expect(screen.queryByLabelText(/Delta .* versus baseline/)).not.toBeInTheDocument()
  })

  it('hides the delta line when value is missing', () => {
    render(<Scoreboard cells={[baseCell({ value: undefined })]} />)
    expect(screen.queryByLabelText(/Delta .* versus baseline/)).not.toBeInTheDocument()
  })

  it('hides the delta line when the delta rounds to zero at the cell precision', () => {
    // 5.381 vs 5.384 → raw delta -0.003, rounds to 0.00 at precision=2.
    render(
      <Scoreboard
        cells={[
          baseCell({
            label: '5-10-5',
            value: 5.381,
            baseline: 5.384,
            precision: 2,
            unit: 's',
            direction: 'lower',
          }),
        ]}
      />,
    )
    expect(screen.queryByLabelText(/Delta .* versus baseline/)).not.toBeInTheDocument()
  })

  it('renders a unique cell for each entry by label', () => {
    const cells: ScoreboardCell[] = [
      baseCell({ label: 'VERT' }),
      baseCell({ label: '5-10-5', value: 5.4, baseline: 5.6, precision: 2, unit: 's', direction: 'lower' }),
      baseCell({ label: '10Y', value: 1.85, baseline: 1.98, precision: 2, unit: 's', direction: 'lower' }),
      baseCell({ label: 'WT', value: 232, baseline: 240, precision: 1, unit: ' lbs', direction: 'lower' }),
    ]
    render(<Scoreboard cells={cells} />)
    expect(screen.getByText('VERT')).toBeInTheDocument()
    expect(screen.getByText('5-10-5')).toBeInTheDocument()
    expect(screen.getByText('10Y')).toBeInTheDocument()
    expect(screen.getByText('WT')).toBeInTheDocument()
    // Each cell gets its own delta line — 4 cells, 4 visible deltas.
    expect(screen.getAllByLabelText(/Delta .* versus baseline/)).toHaveLength(4)
  })

  it('renders zero cells gracefully (empty array)', () => {
    render(<Scoreboard cells={[]} />)
    // The region still renders with no cells inside.
    expect(screen.getByRole('group', { name: 'Scoreboard' })).toBeInTheDocument()
  })
})
