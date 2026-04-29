import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { Benchmark } from '@/types/movement'
import {
  CombineRadar,
  RADAR_AXIS_ORDER,
  buildRadarShape,
  isShapeComplete,
  normalizeMetric,
  projectVertex,
  shapesEqual,
} from './CombineRadar'
import {
  pickMetricBaseline,
  pickMetricLatest,
} from '@/components/training-facility/shared/scoreboard-utils'

/**
 * Coverage for the radar's projection math (pure functions, easy to pin
 * with exact numbers) plus a smoke render confirming the component
 * follows the same undefined/empty/populated pattern as the rest of the
 * Combine surfaces.
 */

describe('normalizeMetric', () => {
  it('maps the elite end of a higher-is-better range to 1', () => {
    // Vertical targetRange is [16, 32], higher is better.
    expect(normalizeMetric('vertical_in', 32)).toBe(1)
  })

  it('maps the worst end of a higher-is-better range to 0', () => {
    expect(normalizeMetric('vertical_in', 16)).toBe(0)
  })

  it('inverts lower-is-better metrics so faster maps to 1', () => {
    // 5-10-5 targetRange is [4.5, 6.0]; 4.5s is elite ⇒ score 1.
    expect(normalizeMetric('shuttle_5_10_5_s', 4.5)).toBe(1)
    expect(normalizeMetric('shuttle_5_10_5_s', 6.0)).toBe(0)
  })

  it('clamps below the elite floor and above the worst ceiling', () => {
    // An exceptional 4.0s 5-10-5 sits past the elite floor — clamp to 1.
    expect(normalizeMetric('shuttle_5_10_5_s', 4.0)).toBe(1)
    // A 7.0s 5-10-5 sits past the worst ceiling — clamp to 0.
    expect(normalizeMetric('shuttle_5_10_5_s', 7.0)).toBe(0)
  })

  it('returns null for missing or non-finite values so axes without data are distinguishable from zero', () => {
    expect(normalizeMetric('vertical_in', undefined)).toBeNull()
    expect(normalizeMetric('vertical_in', Number.NaN)).toBeNull()
    expect(normalizeMetric('vertical_in', Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('projectVertex', () => {
  const geo = { cx: 200, cy: 200, rim: 100 }

  it('puts axis 0 (5-10-5) at 12 o\'clock when score is 1', () => {
    const [x, y] = projectVertex(0, 1, geo)
    expect(x).toBeCloseTo(200, 5)
    expect(y).toBeCloseTo(100, 5)
  })

  it('puts axis 1 (Vertical) at 3 o\'clock when score is 1', () => {
    const [x, y] = projectVertex(1, 1, geo)
    expect(x).toBeCloseTo(300, 5)
    expect(y).toBeCloseTo(200, 5)
  })

  it('puts axis 2 (10y sprint) at 6 o\'clock and axis 3 (Bodyweight) at 9 o\'clock', () => {
    const [x2, y2] = projectVertex(2, 1, geo)
    const [x3, y3] = projectVertex(3, 1, geo)
    expect(x2).toBeCloseTo(200, 5)
    expect(y2).toBeCloseTo(300, 5)
    expect(x3).toBeCloseTo(100, 5)
    expect(y3).toBeCloseTo(200, 5)
  })

  it('collapses to the center when score is 0', () => {
    const [x, y] = projectVertex(0, 0, geo)
    expect(x).toBeCloseTo(200, 5)
    expect(y).toBeCloseTo(200, 5)
  })
})

describe('buildRadarShape', () => {
  const entries: Benchmark[] = [
    {
      date: '2026-01-15',
      shuttle_5_10_5_s: 5.4,
      vertical_in: 22,
      sprint_10y_s: 1.95,
      bodyweight_lbs: 230,
    },
    {
      date: '2026-04-10',
      shuttle_5_10_5_s: 5.1,
      vertical_in: 26,
      sprint_10y_s: 1.8,
      bodyweight_lbs: 222,
    },
  ]

  it('returns one vertex per axis in RADAR_AXIS_ORDER', () => {
    const shape = buildRadarShape(entries, pickMetricLatest)
    expect(shape.vertices.map((v) => v.metric)).toEqual([...RADAR_AXIS_ORDER])
  })

  it('uses the supplied picker — latest gives different scores than baseline', () => {
    const latest = buildRadarShape(entries, pickMetricLatest)
    const earliest = buildRadarShape(entries, pickMetricBaseline)
    // The April session beats January on every axis, so latest scores ≥ earliest scores.
    for (let i = 0; i < latest.vertices.length; i += 1) {
      const a = latest.vertices[i].score
      const b = earliest.vertices[i].score
      expect(a).not.toBeNull()
      expect(b).not.toBeNull()
      expect(a as number).toBeGreaterThanOrEqual(b as number)
    }
  })

  it('produces a per-axis null score when no entry covers that axis', () => {
    const partial: Benchmark[] = [
      { date: '2026-04-10', vertical_in: 26 }, // only vertical
    ]
    const shape = buildRadarShape(partial, pickMetricLatest)
    const vertVertex = shape.vertices.find((v) => v.metric === 'vertical_in')
    const sprintVertex = shape.vertices.find((v) => v.metric === 'sprint_10y_s')
    expect(vertVertex?.score).not.toBeNull()
    expect(sprintVertex?.score).toBeNull()
  })
})

describe('isShapeComplete + shapesEqual', () => {
  it('isShapeComplete is false when any axis is null', () => {
    const partial: Benchmark[] = [{ date: '2026-04-10', vertical_in: 26 }]
    const shape = buildRadarShape(partial, pickMetricLatest)
    expect(isShapeComplete(shape)).toBe(false)
  })

  it('shapesEqual is true when latest and earliest are the same single entry', () => {
    const single: Benchmark[] = [
      {
        date: '2026-04-10',
        shuttle_5_10_5_s: 5.1,
        vertical_in: 26,
        sprint_10y_s: 1.8,
        bodyweight_lbs: 222,
      },
    ]
    const latest = buildRadarShape(single, pickMetricLatest)
    const earliest = buildRadarShape(single, pickMetricBaseline)
    expect(shapesEqual(latest, earliest)).toBe(true)
  })
})

describe('CombineRadar', () => {
  it('renders nothing while the initial fetch is in flight (entries undefined)', () => {
    const { container } = render(<CombineRadar entries={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the benchmark history is empty', () => {
    const { container } = render(<CombineRadar entries={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no entry covers all four axes', () => {
    const { container } = render(
      <CombineRadar
        entries={[{ date: '2026-04-10', vertical_in: 26 }]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the radar inside a labeled section once a complete entry arrives', () => {
    render(
      <CombineRadar
        entries={[
          {
            date: '2026-04-10',
            shuttle_5_10_5_s: 5.1,
            vertical_in: 26,
            sprint_10y_s: 1.8,
            bodyweight_lbs: 222,
          },
        ]}
      />,
    )
    const section = screen.getByRole('region', { name: /combine radar/i })
    expect(section).toBeInTheDocument()
    expect(section.querySelector('svg')).not.toBeNull()
    // With a single complete entry, latest === earliest — the legend should
    // hide the "Earliest" swatch.
    expect(screen.queryByText(/earliest/i)).toBeNull()
    expect(screen.getByText(/latest/i)).toBeInTheDocument()
  })

  it('shows both legend swatches when the history has distinct earliest and latest shapes', () => {
    render(
      <CombineRadar
        entries={[
          {
            date: '2026-01-15',
            shuttle_5_10_5_s: 5.4,
            vertical_in: 22,
            sprint_10y_s: 1.95,
            bodyweight_lbs: 230,
          },
          {
            date: '2026-04-10',
            shuttle_5_10_5_s: 5.1,
            vertical_in: 26,
            sprint_10y_s: 1.8,
            bodyweight_lbs: 222,
          },
        ]}
      />,
    )
    expect(screen.getByText(/latest/i)).toBeInTheDocument()
    expect(screen.getByText(/earliest/i)).toBeInTheDocument()
  })
})
