import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BENCHMARKS } from '@/constants/benchmarks'
import type { Benchmark } from '@/types/movement'
import {
  TradingCard,
  formatCell,
  formatValue,
  isPersonalBest,
  seasonFromDate,
} from './TradingCard'

/**
 * Pure-helper coverage for the trading-card module plus a thin set of RTL
 * renders that pin the visible-on-front contract (4 metrics, click flips,
 * PB badge gated on prior history).
 */

const verticalSpec = BENCHMARKS.vertical_in
const shuttleSpec = BENCHMARKS.shuttle_5_10_5_s
const bodyweightSpec = BENCHMARKS.bodyweight_lbs

describe('isPersonalBest', () => {
  const entry: Benchmark = { date: '2026-04-15', vertical_in: 23, shuttle_5_10_5_s: 4.9 }

  it('returns false when the entry has no value for the metric', () => {
    const noValue: Benchmark = { date: '2026-04-15' }
    expect(isPersonalBest(noValue, [], 'vertical_in', verticalSpec)).toBe(false)
  })

  it('returns false when no prior entry has a value (cannot break a record that does not exist)', () => {
    const onlyEntry: Benchmark = { date: '2026-04-15', vertical_in: 23 }
    expect(isPersonalBest(onlyEntry, [onlyEntry], 'vertical_in', verticalSpec)).toBe(false)
  })

  it('higher-is-better: PB when entry strictly beats every prior value', () => {
    const history: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 19 },
      { date: '2026-03-15', vertical_in: 22 },
      entry,
    ]
    expect(isPersonalBest(entry, history, 'vertical_in', verticalSpec)).toBe(true)
  })

  it('higher-is-better: not a PB when a prior value ties or beats it', () => {
    const tied: Benchmark[] = [{ date: '2026-03-15', vertical_in: 23 }, entry]
    expect(isPersonalBest(entry, tied, 'vertical_in', verticalSpec)).toBe(false)
  })

  it('lower-is-better: PB when entry is strictly faster than every prior value', () => {
    const history: Benchmark[] = [
      { date: '2026-01-15', shuttle_5_10_5_s: 5.4 },
      { date: '2026-03-15', shuttle_5_10_5_s: 5.1 },
      entry,
    ]
    expect(isPersonalBest(entry, history, 'shuttle_5_10_5_s', shuttleSpec)).toBe(true)
  })

  it('lower-is-better: not a PB when a prior value ties or is faster', () => {
    const tied: Benchmark[] = [{ date: '2026-03-15', shuttle_5_10_5_s: 4.9 }, entry]
    expect(isPersonalBest(entry, tied, 'shuttle_5_10_5_s', shuttleSpec)).toBe(false)
  })

  it('only considers strictly-prior entries (a March entry does not lose its PB to April)', () => {
    const march: Benchmark = { date: '2026-03-15', vertical_in: 22 }
    const history: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 19 },
      march,
      { date: '2026-04-15', vertical_in: 24 }, // newer; should not affect march's PB-ness
    ]
    expect(isPersonalBest(march, history, 'vertical_in', verticalSpec)).toBe(true)
  })

  it('skips entries marked is_complete=false', () => {
    const history: Benchmark[] = [
      { date: '2026-01-15', vertical_in: 25, is_complete: false }, // would block PB if counted
      { date: '2026-03-15', vertical_in: 22 },
      entry,
    ]
    expect(isPersonalBest(entry, history, 'vertical_in', verticalSpec)).toBe(true)
  })

  it('skips prior entries missing the metric', () => {
    const history: Benchmark[] = [
      { date: '2026-01-15', shuttle_5_10_5_s: 5.4 }, // no vertical_in
      { date: '2026-03-15', vertical_in: 22 },
      entry,
    ]
    expect(isPersonalBest(entry, history, 'vertical_in', verticalSpec)).toBe(true)
  })
})

describe('formatValue', () => {
  it('returns em-dash when value is missing', () => {
    expect(formatValue(undefined, verticalSpec)).toBe('—')
  })

  it('honors metric precision and unit', () => {
    expect(formatValue(22, verticalSpec)).toBe('22.0"') // precision 1, unit "
    expect(formatValue(4.9, shuttleSpec)).toBe('4.90s') // precision 2, unit s
    expect(formatValue(232.4, bodyweightSpec)).toBe('232.4 lbs') // precision 1, unit " lbs"
  })

  it('rounds rather than truncates', () => {
    expect(formatValue(22.05, verticalSpec)).toBe('22.1"') // toFixed(1) rounds half-up
  })
})

describe('formatCell', () => {
  it('returns em-dash when value is missing', () => {
    expect(formatCell(undefined, verticalSpec)).toBe('—')
  })

  it('emits integers without a decimal point', () => {
    expect(formatCell(22, verticalSpec)).toBe('22')
  })

  it('preserves precision for non-integers (timed metrics keep hundredths)', () => {
    expect(formatCell(1.98, BENCHMARKS.sprint_10y_s)).toBe('1.98')
    expect(formatCell(4.9, shuttleSpec)).toBe('4.90')
  })
})

describe('seasonFromDate', () => {
  it.each([
    ['2026-03-15', '2026 Spring'],
    ['2026-05-31', '2026 Spring'],
    ['2026-06-01', '2026 Summer'],
    ['2026-08-31', '2026 Summer'],
    ['2026-09-01', '2026 Fall'],
    ['2026-11-30', '2026 Fall'],
    ['2026-12-15', '2026 Winter'],
    ['2026-01-01', '2026 Winter'],
    ['2026-02-28', '2026 Winter'],
  ])('maps %s → %s', (date, expected) => {
    expect(seasonFromDate(date)).toBe(expected)
  })
})

describe('TradingCard render', () => {
  const entry: Benchmark = {
    date: '2026-04-15',
    vertical_in: 23,
    shuttle_5_10_5_s: 4.9,
    sprint_10y_s: 1.85,
    bodyweight_lbs: 232,
  }

  it('renders all 4 metrics on the front face with values and short labels', () => {
    render(<TradingCard entry={entry} history={[entry]} />)
    // Short labels appear in both the front <li> and the back-of-card <th>
    // (the back is in the DOM permanently, just hidden via 3D rotation).
    // Each label should match exactly twice.
    expect(screen.getAllByText('VERT')).toHaveLength(2)
    expect(screen.getAllByText('5-10-5')).toHaveLength(2)
    expect(screen.getAllByText('10Y')).toHaveLength(2)
    expect(screen.getAllByText('WT')).toHaveLength(2)
    // Front-face values use formatValue (precision + unit). The back uses
    // formatCell which renders integers without a trailing decimal, so these
    // formatted strings are unique to the front.
    expect(screen.getByText('23.0"')).toBeInTheDocument()
    expect(screen.getByText('4.90s')).toBeInTheDocument()
    expect(screen.getByText('1.85s')).toBeInTheDocument()
    expect(screen.getByText('232.0 lbs')).toBeInTheDocument()
  })

  it('uses a season-derived label when season prop is omitted', () => {
    render(<TradingCard entry={entry} history={[entry]} />)
    // 2026-04-15 → Spring
    expect(screen.getByText('2026 Spring')).toBeInTheDocument()
  })

  it('honors custom season + playerName + playerNumber', () => {
    render(
      <TradingCard
        entry={entry}
        history={[entry]}
        season="Custom Season"
        playerName="Test Player"
        playerNumber={42}
      />,
    )
    expect(screen.getByText('Custom Season')).toBeInTheDocument()
    expect(screen.getByText('Test Player')).toBeInTheDocument()
    expect(screen.getByText('#42')).toBeInTheDocument()
  })

  it('flips between front and back when clicked (aria-pressed reflects state)', async () => {
    const user = userEvent.setup()
    render(<TradingCard entry={entry} history={[entry]} />)
    const card = screen.getByRole('button')
    expect(card).toHaveAttribute('aria-pressed', 'false')

    await user.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')

    await user.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the PB badge when the entry sets a personal best (with prior history)', () => {
    const prior: Benchmark = { date: '2026-01-15', vertical_in: 19, shuttle_5_10_5_s: 5.4 }
    render(<TradingCard entry={entry} history={[prior, entry]} />)
    // "★ PB" rendered in the front footer
    expect(screen.getByText(/★\s*PB/i)).toBeInTheDocument()
  })

  it('does NOT show the PB badge when no prior history exists', () => {
    render(<TradingCard entry={entry} history={[entry]} />)
    expect(screen.queryByText(/★\s*PB/i)).not.toBeInTheDocument()
  })

  it('shows "No prior sessions" on the back when history is empty', () => {
    // The empty-table branch fires on `sortedHistory.length === 0` — meaning
    // the caller passed `history={[]}` (no entries at all). When even just
    // `entry` is in the history list the table renders that single row
    // instead of the empty-state message.
    render(<TradingCard entry={entry} history={[]} />)
    expect(screen.getByText(/No prior sessions/i)).toBeInTheDocument()
  })

  it('renders prior session rows in the back-of-card history table', () => {
    const prior: Benchmark = { date: '2026-01-15', vertical_in: 19 }
    render(<TradingCard entry={entry} history={[prior, entry]} historyLimit={5} />)
    // Date column slices YYYY-MM-DD to MM-DD ("01-15", "04-15").
    expect(screen.getByText('01-15')).toBeInTheDocument()
    expect(screen.getByText('04-15')).toBeInTheDocument()
  })

  it('renders notes on the back when the entry has them', () => {
    const withNotes: Benchmark = { ...entry, notes: 'felt strong' }
    render(<TradingCard entry={withNotes} history={[withNotes]} />)
    expect(screen.getByText(/felt strong/i)).toBeInTheDocument()
  })
})
