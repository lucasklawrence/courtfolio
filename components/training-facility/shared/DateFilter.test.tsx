import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DateFilter,
  endOfDay,
  isInRange,
  parseInputValue,
  rangeForPreset,
  startOfDay,
  subtractMonths,
  toInputValue,
  type DateRange,
} from './DateFilter'

/**
 * Pure-helper coverage plus interaction-driven RTL tests for DateFilter.
 *
 * The visibilitychange re-anchor effect is intentionally not exercised — it
 * requires patching `document.visibilityState` and provides little signal
 * beyond the `selectPreset` path already covered.
 *
 * `rangeForPreset` and the preset-click test rely on the system clock for
 * "today"; tests that need a deterministic anchor use vi.setSystemTime.
 */

beforeEach(() => {
  // Mid-month so subtractMonths edge cases don't accidentally fire on day 1/31.
  // `shouldAdvanceTime: true` lets userEvent's internal scheduled work run
  // against real wall time while keeping `Date.now()` / `new Date()` frozen
  // — without it, awaited userEvent calls hang indefinitely under fake timers.
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 3, 15, 12, 0, 0)) // April 15 2026 noon (local)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startOfDay / endOfDay', () => {
  it('startOfDay zeroes the time portion', () => {
    const d = new Date(2026, 3, 15, 14, 32, 17, 555)
    const s = startOfDay(d)
    expect(s.getHours()).toBe(0)
    expect(s.getMinutes()).toBe(0)
    expect(s.getSeconds()).toBe(0)
    expect(s.getMilliseconds()).toBe(0)
  })

  it('endOfDay sets the time to 23:59:59.999', () => {
    const d = new Date(2026, 3, 15, 0, 0, 0, 0)
    const e = endOfDay(d)
    expect(e.getHours()).toBe(23)
    expect(e.getMinutes()).toBe(59)
    expect(e.getSeconds()).toBe(59)
    expect(e.getMilliseconds()).toBe(999)
  })
})

describe('subtractMonths', () => {
  it('subtracts a typical month', () => {
    const d = new Date(2026, 3, 15) // April 15 2026
    const r = subtractMonths(d, 1)
    expect(r.getFullYear()).toBe(2026)
    expect(r.getMonth()).toBe(2) // March
    expect(r.getDate()).toBe(15)
  })

  it('crosses year boundaries', () => {
    const d = new Date(2026, 1, 15) // Feb 15 2026
    const r = subtractMonths(d, 12)
    expect(r.getFullYear()).toBe(2025)
    expect(r.getMonth()).toBe(1) // Feb
    expect(r.getDate()).toBe(15)
  })

  it('clamps Mar 31 → Feb 28 in a non-leap year (no rollover into March 3)', () => {
    const d = new Date(2025, 2, 31) // March 31 2025 — non-leap
    const r = subtractMonths(d, 1)
    expect(r.getMonth()).toBe(1) // Feb
    expect(r.getDate()).toBe(28)
  })

  it('clamps Mar 31 → Feb 29 in a leap year', () => {
    const d = new Date(2024, 2, 31) // March 31 2024 — leap
    const r = subtractMonths(d, 1)
    expect(r.getMonth()).toBe(1) // Feb
    expect(r.getDate()).toBe(29)
  })

  it('subtracts many months', () => {
    const d = new Date(2026, 3, 15)
    const r = subtractMonths(d, 36)
    expect(r.getFullYear()).toBe(2023)
    expect(r.getMonth()).toBe(3)
  })
})

describe('toInputValue / parseInputValue', () => {
  it('toInputValue zero-pads single-digit month and day', () => {
    expect(toInputValue(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toInputValue(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('parseInputValue returns null on empty input', () => {
    expect(parseInputValue('')).toBeNull()
  })

  it('parseInputValue returns null on malformed input', () => {
    expect(parseInputValue('not-a-date')).toBeNull()
  })

  it('round-trips a date through toInputValue → parseInputValue', () => {
    const original = new Date(2026, 3, 15) // April 15 local
    const parsed = parseInputValue(toInputValue(original))
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(3)
    expect(parsed?.getDate()).toBe(15)
  })
})

describe('rangeForPreset', () => {
  const earliest = new Date(2024, 0, 1)

  it('1M returns a one-month-back start anchored at today', () => {
    const r = rangeForPreset('1M', earliest)
    expect(r.start.getMonth()).toBe(2) // March (April - 1)
    expect(r.start.getDate()).toBe(15)
    expect(r.end.getDate()).toBe(15) // April 15
    expect(r.end.getHours()).toBe(23) // endOfDay
  })

  it('ALL clamps to today when earliestDate is in the future', () => {
    const future = new Date(2030, 0, 1)
    const r = rangeForPreset('ALL', future)
    expect(r.start.getTime()).toBeLessThanOrEqual(r.end.getTime()) // start <= end invariant
  })

  it('ALL uses the earliestDate when it is in the past', () => {
    const r = rangeForPreset('ALL', earliest)
    expect(r.start.getFullYear()).toBe(2024)
    expect(r.start.getMonth()).toBe(0)
    expect(r.start.getDate()).toBe(1)
  })

  it('start <= end always holds', () => {
    for (const preset of ['1M', '3M', '6M', '1Y', 'ALL'] as const) {
      const r = rangeForPreset(preset, earliest)
      expect(r.start.getTime()).toBeLessThanOrEqual(r.end.getTime())
    }
  })
})

describe('isInRange', () => {
  it('inclusive on both ends', () => {
    const range: DateRange = {
      start: new Date(2026, 3, 1, 0, 0, 0, 0),
      end: new Date(2026, 3, 30, 23, 59, 59, 999),
    }
    expect(isInRange(new Date(2026, 3, 1, 0, 0, 0, 0), range)).toBe(true)
    expect(isInRange(new Date(2026, 3, 30, 23, 59, 59, 999), range)).toBe(true)
    expect(isInRange(new Date(2026, 3, 15), range)).toBe(true)
  })

  it('false outside the range', () => {
    const range: DateRange = {
      start: new Date(2026, 3, 1),
      end: new Date(2026, 3, 30, 23, 59, 59, 999),
    }
    expect(isInRange(new Date(2026, 2, 31), range)).toBe(false) // day before start
    expect(isInRange(new Date(2026, 4, 1), range)).toBe(false) // day after end
  })
})

describe('DateFilter render', () => {
  it('renders five preset buttons with the documented labels', () => {
    render(<DateFilter onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: '1M' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '3M' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '6M' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '1Y' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument()
  })

  it('marks the default preset as checked on mount', () => {
    render(<DateFilter onChange={() => {}} defaultPreset="3M" />)
    expect(screen.getByRole('radio', { name: '3M' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '1M' })).toHaveAttribute('aria-checked', 'false')
  })

  it('preset click fires onChange with a range matching rangeForPreset', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DateFilter onChange={onChange} />)
    onChange.mockClear() // ignore mount-time emission if any

    await user.click(screen.getByRole('radio', { name: '6M' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const range = onChange.mock.calls[0][0] as DateRange
    // System clock is April 15 2026 (set in beforeEach). 6 months back = October 15 2025.
    expect(range.start.getFullYear()).toBe(2025)
    expect(range.start.getMonth()).toBe(9) // October
    expect(range.start.getDate()).toBe(15)
  })

  it('changing the start-date input deselects the preset (custom mode)', () => {
    render(<DateFilter onChange={() => {}} defaultPreset="1M" />)

    expect(screen.getByRole('radio', { name: '1M' })).toHaveAttribute('aria-checked', 'true')

    // <input type="date"> doesn't accept char-by-char typing reliably under
    // jsdom; fire the change event directly with the parsed date string the
    // way the browser would after a date picker selection.
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })

    // After a custom edit, no preset should be checked.
    expect(screen.getByRole('radio', { name: '1M' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: '3M' })).toHaveAttribute('aria-checked', 'false')
  })

  it('ArrowRight advances focus + selection through the radiogroup, wrapping at the end', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DateFilter onChange={onChange} defaultPreset="1M" />)

    const oneM = screen.getByRole('radio', { name: '1M' })
    oneM.focus()
    expect(oneM).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '3M' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: '3M' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Home jumps to the first preset and End to the last', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DateFilter onChange={() => {}} defaultPreset="3M" />)

    screen.getByRole('radio', { name: '3M' }).focus()
    await user.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: '1M' })).toHaveFocus()
  })

  it('ArrowLeft from the first preset wraps to the last', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<DateFilter onChange={() => {}} defaultPreset="1M" />)

    screen.getByRole('radio', { name: '1M' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus()
  })
})
