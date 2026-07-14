import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoughBar, RoughLine, RoughScatter, RoughSparkline } from './'
import { formatDateAxisTick } from './RoughLine'

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

  it('draws a dashed overlay path when a two-point overlay is supplied (#267)', () => {
    const { container } = render(
      <RoughLine
        data={[
          { x: 0, y: 1 },
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ]}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        overlay={[
          { x: 0, y: 1 },
          { x: 2, y: 3 },
        ]}
        ariaLabel="trend with overlay"
      />,
    )
    const overlayPath = container.querySelector('[data-testid="rough-line-overlay"]')
    expect(overlayPath).not.toBeNull()
    // Crisp polyline (M…L…), dashed, not a rough.js multi-stroke sketch.
    expect(overlayPath?.getAttribute('d')).toMatch(/^M[\d.-]+,[\d.-]+ L/)
    expect(overlayPath?.getAttribute('stroke-dasharray')).toBe('6 4')
  })

  it('draws a time-axis overlay (the OTF regression path) without clipping (#267)', () => {
    // Mirrors OtfTrendChart: Date x + a two-point regression overlay whose
    // endpoints exceed the data's y-range, so the extent-folding must widen
    // the y-domain to keep the dashed line on-canvas.
    const { container } = render(
      <RoughLine
        data={[
          { x: new Date(2026, 5, 1), y: 10 },
          { x: new Date(2026, 5, 3), y: 14 },
          { x: new Date(2026, 5, 5), y: 12 },
        ]}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        overlay={[
          { x: new Date(2026, 5, 1), y: 9 },
          { x: new Date(2026, 5, 5), y: 15 },
        ]}
        ariaLabel="date trend with regression"
      />,
    )
    const overlayPath = container.querySelector('[data-testid="rough-line-overlay"]')
    expect(overlayPath).not.toBeNull()
    expect(overlayPath?.getAttribute('stroke-dasharray')).toBe('6 4')
  })

  it('renders no overlay path when the overlay has fewer than two points', () => {
    const { container } = render(
      <RoughLine
        data={[
          { x: 0, y: 1 },
          { x: 1, y: 2 },
        ]}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        overlay={[{ x: 0, y: 1 }]}
        ariaLabel="trend with degenerate overlay"
      />,
    )
    expect(container.querySelector('[data-testid="rough-line-overlay"]')).toBeNull()
  })

  it('labels multi-year date ticks with a year so they are not all "Jan"', () => {
    // A >1yr Date domain: d3 lands ticks on year boundaries. Without a year in
    // the label every tick reads identically ("Jan 1"); the span-aware default
    // formatter must include the year instead.
    render(
      <RoughLine
        data={[
          { x: new Date(2023, 0, 1), y: 1 },
          { x: new Date(2024, 6, 1), y: 2 },
          { x: new Date(2025, 11, 1), y: 3 },
        ]}
        x={(d) => d.x}
        y={(d) => d.y}
        width={600}
        height={200}
        ariaLabel="multi-year trend"
      />,
    )
    expect(screen.getAllByText(/20\d\d/).length).toBeGreaterThan(0)
  })

  it('omits the year on sub-year date spans (compact month/day labels)', () => {
    render(
      <RoughLine
        data={[
          { x: new Date(2026, 0, 1), y: 1 },
          { x: new Date(2026, 1, 15), y: 2 },
        ]}
        x={(d) => d.x}
        y={(d) => d.y}
        width={400}
        height={200}
        ariaLabel="two-month trend"
      />,
    )
    expect(screen.queryAllByText(/20\d\d/)).toHaveLength(0)
  })
})

describe('formatDateAxisTick', () => {
  const DAY = 24 * 60 * 60 * 1000

  it('includes the year once the span exceeds ~13 months', () => {
    expect(formatDateAxisTick(new Date(2024, 0, 1), 500 * DAY)).toMatch(/2024/)
  })

  it('uses a compact month/day label for sub-year spans', () => {
    expect(formatDateAxisTick(new Date(2026, 3, 1), 60 * DAY)).not.toMatch(/20\d\d/)
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

describe('RoughSparkline', () => {
  const pts = (ys: number[]) => ys.map((y, i) => ({ x: i, y }))

  it('renders an empty (no-path) svg with its label when there are no points', () => {
    render(<RoughSparkline points={[]} width={140} height={32} ariaLabel="distance sparkline" />)
    expect(screen.getByRole('img', { name: 'distance sparkline' })).toBeInTheDocument()
  })

  it('plumbs ariaLabel through to the SVG when points are present', () => {
    render(
      <RoughSparkline
        points={pts([2100, 2340, 2260, 2510, 2620])}
        width={140}
        height={32}
        ariaLabel="rower distance sparkline"
      />,
    )
    expect(screen.getByRole('img', { name: 'rower distance sparkline' })).toBeInTheDocument()
  })

  it('renders a single point without throwing (draws just the dot)', () => {
    render(
      <RoughSparkline points={pts([2000])} width={140} height={32} ariaLabel="one point" />,
    )
    expect(screen.getByRole('img', { name: 'one point' })).toBeInTheDocument()
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
