import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Benchmark } from '@/types/movement'
import {
  SprintRace,
  buildLaneYs,
  computeDotX,
  formatSprintChipLabel,
  pickSprintRuns,
  svgHeight,
} from './SprintRace'

/**
 * Smoke + unit coverage for the Combine sprint-race visualization (PRD
 * §9.6). Geometry helpers are pure and asserted exactly; the component
 * surface itself follows the same "pin the contract, leave the rAF
 * details alone" approach as ShuttleTrace and CombineTradingCard.
 */

describe('pickSprintRuns', () => {
  it('returns an empty list when no entry has a sprint time', () => {
    const entries: Benchmark[] = [
      { date: '2026-03-15', vertical_in: 22 },
      { date: '2026-04-10', bodyweight_lbs: 230 },
    ]
    expect(pickSprintRuns(entries)).toEqual([])
  })

  it('keeps only finite-positive sprint times and skips incomplete sessions', () => {
    const entries: Benchmark[] = [
      { date: '2026-01-15', sprint_10y_s: 1.95 },
      { date: '2026-02-15', sprint_10y_s: 0 },
      { date: '2026-02-20', sprint_10y_s: Number.NaN },
      { date: '2026-03-15', sprint_10y_s: 1.85, is_complete: false },
      { date: '2026-04-10', sprint_10y_s: 1.78 },
    ]
    expect(pickSprintRuns(entries)).toEqual([
      { date: '2026-01-15', seconds: 1.95 },
      { date: '2026-04-10', seconds: 1.78 },
    ])
  })

  it('sorts results ascending by date so callers can index "latest" at the end', () => {
    const entries: Benchmark[] = [
      { date: '2026-04-10', sprint_10y_s: 1.78 },
      { date: '2026-01-15', sprint_10y_s: 1.95 },
      { date: '2026-03-15', sprint_10y_s: 1.85 },
    ]
    const runs = pickSprintRuns(entries)
    expect(runs.map((r) => r.date)).toEqual(['2026-01-15', '2026-03-15', '2026-04-10'])
  })
})

describe('formatSprintChipLabel', () => {
  it('renders an ISO date as "Mon YYYY"', () => {
    expect(formatSprintChipLabel('2026-04-10')).toBe('Apr 2026')
    expect(formatSprintChipLabel('2026-01-31')).toBe('Jan 2026')
    expect(formatSprintChipLabel('2025-12-01')).toBe('Dec 2025')
  })

  it('returns the raw input when the format does not match', () => {
    expect(formatSprintChipLabel('not-a-date')).toBe('not-a-date')
    expect(formatSprintChipLabel('2026-13-01')).toBe('2026-13-01')
  })
})

describe('computeDotX', () => {
  it('starts at the left edge before the race begins', () => {
    expect(computeDotX(0, 1.91)).toBe(100)
    expect(computeDotX(-0.5, 1.91)).toBe(100)
  })

  it('reaches the right edge once elapsed >= seconds', () => {
    expect(computeDotX(1.91, 1.91)).toBe(600)
    expect(computeDotX(5, 1.91)).toBe(600)
  })

  it('interpolates linearly between start and finish', () => {
    // Half the time → half the distance: TRACK_X_LEFT + 0.5 * TRACK_W = 100 + 250 = 350
    expect(computeDotX(0.95, 1.9)).toBeCloseTo(350, 5)
  })

  it('clamps to the start when seconds is zero or non-finite', () => {
    expect(computeDotX(1, 0)).toBe(100)
    expect(computeDotX(1, Number.NaN)).toBe(100)
  })
})

describe('buildLaneYs', () => {
  it('returns one y per run, with the latest run on the smallest y (top)', () => {
    const ys = buildLaneYs([
      { date: '2026-01-15', seconds: 1.95 },
      { date: '2026-02-15', seconds: 1.85 },
      { date: '2026-04-10', seconds: 1.78 },
    ])
    expect(ys).toHaveLength(3)
    // Latest (index 2) is on top → smaller y than index 1 → smaller y than index 0
    expect(ys[2]).toBeLessThan(ys[1])
    expect(ys[1]).toBeLessThan(ys[0])
  })

  it('returns an empty list for no runs', () => {
    expect(buildLaneYs([])).toEqual([])
  })

  it('places lanes 46 viewBox units apart', () => {
    const ys = buildLaneYs([
      { date: '2026-01-15', seconds: 1.95 },
      { date: '2026-02-15', seconds: 1.85 },
    ])
    expect(Math.abs(ys[0] - ys[1])).toBe(46)
  })
})

describe('svgHeight', () => {
  it('grows by lane height per run', () => {
    expect(svgHeight(0)).toBe(14 + 18)
    expect(svgHeight(1)).toBe(14 + 46 + 18)
    expect(svgHeight(3)).toBe(14 + 3 * 46 + 18)
  })
})

describe('SprintRace', () => {
  it('renders nothing while the initial fetch is in flight (entries undefined)', () => {
    const { container } = render(<SprintRace entries={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the benchmark history has no sprint data', () => {
    const { container } = render(
      <SprintRace
        entries={[
          { date: '2026-03-15', vertical_in: 22 },
          { date: '2026-04-10', bodyweight_lbs: 230 },
        ]}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the labeled section, sprint lane SVG, Race button, and one chip per run', () => {
    render(
      <SprintRace
        entries={[
          { date: '2026-01-15', sprint_10y_s: 1.95 },
          { date: '2026-04-10', sprint_10y_s: 1.78 },
        ]}
      />,
    )
    expect(
      screen.getByRole('region', { name: /sprint race vs past selves/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /10-yard sprint lane/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^race$/i })).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: /jan 2026 — 1\.95s sprint/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: /apr 2026 — 1\.78s sprint/i }),
    ).toBeInTheDocument()
  })

  it('chips start checked and toggle off when clicked', async () => {
    const user = userEvent.setup()
    render(<SprintRace entries={[{ date: '2026-04-10', sprint_10y_s: 1.78 }]} />)
    const chip = screen.getByRole('switch', { name: /apr 2026/i })
    expect(chip).toHaveAttribute('aria-checked', 'true')
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-checked', 'false')
  })

  it('renders one toggle chip per qualifying run when several are present', () => {
    render(
      <SprintRace
        entries={[
          { date: '2026-01-15', sprint_10y_s: 1.95 },
          { date: '2026-02-15', sprint_10y_s: 1.9 },
          { date: '2026-04-10', sprint_10y_s: 1.78 },
        ]}
      />,
    )
    expect(screen.getAllByRole('switch')).toHaveLength(3)
  })

  it('clicking Race leaves toggle state intact', async () => {
    const user = userEvent.setup()
    render(<SprintRace entries={[{ date: '2026-04-10', sprint_10y_s: 1.78 }]} />)
    const chip = screen.getByRole('switch', { name: /apr 2026/i })
    expect(chip).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('button', { name: /^race$/i }))
    expect(chip).toHaveAttribute('aria-checked', 'true')
  })

  it('preserves a user-toggled-off chip when an unrelated entry arrives', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <SprintRace
        entries={[
          { date: '2026-02-15', sprint_10y_s: 1.9 },
          { date: '2026-03-15', sprint_10y_s: 1.85 },
        ]}
      />,
    )
    await user.click(screen.getByRole('switch', { name: /mar 2026/i }))
    expect(screen.getByRole('switch', { name: /mar 2026/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    rerender(
      <SprintRace
        entries={[
          { date: '2026-02-15', sprint_10y_s: 1.9 },
          { date: '2026-03-15', sprint_10y_s: 1.85 },
          { date: '2026-04-10', sprint_10y_s: 1.78 },
        ]}
      />,
    )
    expect(screen.getByRole('switch', { name: /feb 2026/i })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('switch', { name: /mar 2026/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByRole('switch', { name: /apr 2026/i })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
})
