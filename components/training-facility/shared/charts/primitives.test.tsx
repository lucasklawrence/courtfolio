import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoughBar, RoughLine, RoughScatter } from './'

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
