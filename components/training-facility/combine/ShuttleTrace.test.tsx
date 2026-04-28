import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Benchmark } from '@/types/movement'
import {
  ShuttleTrace,
  SHUTTLE_GEOMETRY,
  buildTrailPath,
  computeShuttlePosition,
  formatShuttleChipLabel,
  pickShuttleRuns,
} from './ShuttleTrace'

/**
 * Smoke + unit coverage for the Combine shuttle-trace visualization
 * (PRD §9.5). The geometry helpers are pure and easy to assert exactly;
 * the React component itself follows the same "pin the contract, leave
 * the framer-motion details alone" approach as CombineTradingCard.
 */

describe('pickShuttleRuns', () => {
  it('returns an empty list when no entry has a shuttle time', () => {
    const entries: Benchmark[] = [
      { date: '2026-03-15', vertical_in: 22 },
      { date: '2026-04-10', bodyweight_lbs: 230 },
    ]
    expect(pickShuttleRuns(entries)).toEqual([])
  })

  it('keeps only finite-positive shuttle times and skips incomplete sessions', () => {
    const entries: Benchmark[] = [
      { date: '2026-01-15', shuttle_5_10_5_s: 6.1 },
      { date: '2026-02-15', shuttle_5_10_5_s: 0 },
      { date: '2026-02-20', shuttle_5_10_5_s: Number.NaN },
      { date: '2026-03-15', shuttle_5_10_5_s: 5.6, is_complete: false },
      { date: '2026-04-10', shuttle_5_10_5_s: 5.42 },
    ]
    expect(pickShuttleRuns(entries)).toEqual([
      { date: '2026-01-15', seconds: 6.1 },
      { date: '2026-04-10', seconds: 5.42 },
    ])
  })

  it('sorts results ascending by date so callers can index "latest" at the end', () => {
    const entries: Benchmark[] = [
      { date: '2026-04-10', shuttle_5_10_5_s: 5.42 },
      { date: '2026-01-15', shuttle_5_10_5_s: 6.1 },
      { date: '2026-03-15', shuttle_5_10_5_s: 5.7 },
    ]
    const runs = pickShuttleRuns(entries)
    expect(runs.map((r) => r.date)).toEqual(['2026-01-15', '2026-03-15', '2026-04-10'])
  })
})

describe('formatShuttleChipLabel', () => {
  it('renders an ISO date as "Mon YYYY"', () => {
    expect(formatShuttleChipLabel('2026-04-10')).toBe('Apr 2026')
    expect(formatShuttleChipLabel('2026-01-31')).toBe('Jan 2026')
    expect(formatShuttleChipLabel('2025-12-01')).toBe('Dec 2025')
  })

  it('returns the raw input when the format does not match', () => {
    expect(formatShuttleChipLabel('not-a-date')).toBe('not-a-date')
    expect(formatShuttleChipLabel('2026-13-01')).toBe('2026-13-01')
  })
})

describe('computeShuttlePosition', () => {
  it('returns the center cone at the start and finish', () => {
    expect(computeShuttlePosition(0)).toEqual(SHUTTLE_GEOMETRY.center)
    expect(computeShuttlePosition(1)).toEqual(SHUTTLE_GEOMETRY.center)
  })

  it('reaches the right cone at the first quarter and the left cone at the third quarter', () => {
    expect(computeShuttlePosition(0.25)).toEqual(SHUTTLE_GEOMETRY.right)
    expect(computeShuttlePosition(0.75)).toEqual(SHUTTLE_GEOMETRY.left)
  })

  it('clamps out-of-range t to the endpoints rather than extrapolating', () => {
    expect(computeShuttlePosition(-1)).toEqual(SHUTTLE_GEOMETRY.center)
    expect(computeShuttlePosition(2)).toEqual(SHUTTLE_GEOMETRY.center)
  })
})

describe('buildTrailPath', () => {
  it('starts with the center cone before any progress is made', () => {
    expect(buildTrailPath(0).startsWith(`${SHUTTLE_GEOMETRY.center.x.toFixed(2)},`)).toBe(true)
  })

  it('passes through both touched cones once the runner finishes', () => {
    const path = buildTrailPath(1)
    const tokens = path.split(' ')
    // center → right → left → center
    expect(tokens).toHaveLength(4)
    expect(tokens[0]).toBe(`${SHUTTLE_GEOMETRY.center.x.toFixed(2)},${SHUTTLE_GEOMETRY.center.y.toFixed(2)}`)
    expect(tokens[1]).toBe(`${SHUTTLE_GEOMETRY.right.x.toFixed(2)},${SHUTTLE_GEOMETRY.right.y.toFixed(2)}`)
    expect(tokens[2]).toBe(`${SHUTTLE_GEOMETRY.left.x.toFixed(2)},${SHUTTLE_GEOMETRY.left.y.toFixed(2)}`)
    expect(tokens[3]).toBe(`${SHUTTLE_GEOMETRY.center.x.toFixed(2)},${SHUTTLE_GEOMETRY.center.y.toFixed(2)}`)
  })

  it('appends the live dot position when the runner is mid-leg', () => {
    // Halfway through leg 2 (cross from right to left): t = 0.5
    const path = buildTrailPath(0.5)
    const tokens = path.split(' ')
    // center, right, current dot
    expect(tokens).toHaveLength(3)
    const dot = computeShuttlePosition(0.5)
    expect(tokens[2]).toBe(`${dot.x.toFixed(2)},${dot.y.toFixed(2)}`)
  })
})

describe('ShuttleTrace', () => {
  it('renders nothing while the initial fetch is in flight (entries undefined)', () => {
    const { container } = render(<ShuttleTrace entries={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the benchmark history has no shuttle data', () => {
    const { container } = render(
      <ShuttleTrace
        entries={[
          { date: '2026-03-15', vertical_in: 22 },
          { date: '2026-04-10', bodyweight_lbs: 230 },
        ]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the labeled section, court diagram, replay button, and a chip per run', () => {
    render(
      <ShuttleTrace
        entries={[
          { date: '2026-01-15', shuttle_5_10_5_s: 6.1 },
          { date: '2026-04-10', shuttle_5_10_5_s: 5.42 },
        ]}
      />,
    )
    expect(
      screen.getByRole('region', { name: /shuttle trace on the court/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /half-court diagram/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /replay/i })).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: /jan 2026 — 6\.10s shuttle/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: /apr 2026 — 5\.42s shuttle/i }),
    ).toBeInTheDocument()
  })

  it('chips start checked and toggle off when clicked', async () => {
    const user = userEvent.setup()
    render(
      <ShuttleTrace
        entries={[{ date: '2026-04-10', shuttle_5_10_5_s: 5.42 }]}
      />,
    )
    const chip = screen.getByRole('switch', { name: /apr 2026/i })
    expect(chip).toHaveAttribute('aria-checked', 'true')
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-checked', 'false')
  })
})
