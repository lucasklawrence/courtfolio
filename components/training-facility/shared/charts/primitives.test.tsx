import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoughBar, RoughLine, RoughMultiLine, RoughScatter } from './'

/**
 * Minimal render coverage for the chart primitives. Per the issue's P2 list:
 *
 * - empty-data branch returns the EmptyChart placeholder
 * - ariaLabel + ariaLabelledBy plumbed onto the SVG (so screen readers
 *   actually announce something for hand-drawn data)
 *
 * Path output (from rough.js) is intentionally not asserted — the visual is
 * spot-checked on the dev/charts preview, and re-rendering an SVG with a
 * stable seed already happens in production every time the page loads.
 */

describe('RoughLine', () => {
  it('renders the EmptyChart placeholder when data is empty', () => {
    render(
      <RoughLine
        data={[] as Array<{ x: number; y: number }>}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        ariaLabel="line chart"
        emptyMessage="No data yet"
      />,
    )
    // EmptyChart renders the message as a <text> element inside the SVG.
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('uses the default empty message when none is provided', () => {
    render(
      <RoughLine
        data={[] as Array<{ x: number; y: number }>}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        ariaLabel="line chart"
      />,
    )
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('plumbs ariaLabel through to the SVG when data is present', () => {
    render(
      <RoughLine
        data={[
          { x: 0, y: 1 },
          { x: 1, y: 2 },
        ]}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        ariaLabel="vertical jump trend"
      />,
    )
    expect(screen.getByRole('img', { name: 'vertical jump trend' })).toBeInTheDocument()
  })

  it('plumbs ariaLabelledBy to the SVG and omits aria-label in that case', () => {
    render(
      <>
        <h2 id="chart-heading">Chart heading</h2>
        <RoughLine
          data={[{ x: 0, y: 1 }]}
          x={(d) => d.x}
          y={(d) => d.y}
          width={400}
          height={200}
          ariaLabelledBy="chart-heading"
        />
      </>,
    )
    // role=img plus aria-labelledby resolves the accessible name from the heading.
    expect(screen.getByRole('img', { name: 'Chart heading' })).toBeInTheDocument()
  })
})

describe('RoughBar', () => {
  it('renders the EmptyChart placeholder when data is empty', () => {
    render(
      <RoughBar
        data={[] as Array<{ k: string; v: number }>}
        x={(d) => d.k}
        y={(d) => d.v}
        width={400}
        height={200}
        ariaLabel="bar chart"
        emptyMessage="No bars yet"
      />,
    )
    expect(screen.getByText('No bars yet')).toBeInTheDocument()
  })

  it('plumbs ariaLabel through to the SVG when data is present', () => {
    render(
      <RoughBar
        data={[
          { k: 'A', v: 10 },
          { k: 'B', v: 20 },
        ]}
        x={(d) => d.k}
        y={(d) => d.v}
        width={400}
        height={200}
        ariaLabel="HR zone distribution"
      />,
    )
    expect(screen.getByRole('img', { name: 'HR zone distribution' })).toBeInTheDocument()
  })
})

describe('RoughMultiLine', () => {
  const dateSeries = (label: string, ys: number[]) => ({
    label,
    color: '#ea580c',
    points: ys.map((y, i) => ({ x: new Date(2026, 5, i + 1), y })),
  })

  it('renders the EmptyChart placeholder when every series is empty', () => {
    render(
      <RoughMultiLine
        series={[
          { label: 'a', color: '#ea580c', points: [] },
          { label: 'b', color: '#2563eb', points: [] },
        ]}
        width={400}
        height={200}
        ariaLabel="combined chart"
        emptyMessage="No machine data yet"
      />,
    )
    expect(screen.getByText('No machine data yet')).toBeInTheDocument()
  })

  it('plumbs ariaLabel through to the SVG when at least one series has points', () => {
    render(
      <RoughMultiLine
        series={[dateSeries('distance', [0, 1]), dateSeries('time', [0.2, 0.8])]}
        width={400}
        height={200}
        yDomain={[0, 1]}
        ariaLabel="rower combined trends"
      />,
    )
    expect(screen.getByRole('img', { name: 'rower combined trends' })).toBeInTheDocument()
  })

  it('renders even when only some series have points (skips the empty ones)', () => {
    render(
      <RoughMultiLine
        series={[dateSeries('distance', [0, 1]), { label: 'pace', color: '#16a34a', points: [] }]}
        width={400}
        height={200}
        yDomain={[0, 1]}
        ariaLabel="partial combined trends"
      />,
    )
    expect(screen.getByRole('img', { name: 'partial combined trends' })).toBeInTheDocument()
  })
})

describe('RoughScatter', () => {
  it('renders the EmptyChart placeholder when data is empty', () => {
    render(
      <RoughScatter
        data={[] as Array<{ x: number; y: number }>}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        ariaLabel="scatter chart"
        emptyMessage="No samples yet"
      />,
    )
    expect(screen.getByText('No samples yet')).toBeInTheDocument()
  })

  it('plumbs ariaLabel through to the SVG when data is present', () => {
    render(
      <RoughScatter
        data={[
          { x: 142, y: 9.8 },
          { x: 158, y: 8.7 },
        ]}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        ariaLabel="pace vs heart rate"
      />,
    )
    expect(screen.getByRole('img', { name: 'pace vs heart rate' })).toBeInTheDocument()
  })
})
