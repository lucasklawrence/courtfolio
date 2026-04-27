'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'

/**
 * Inclusive date range emitted by `DateFilter`. `start` is normalized to
 * local start-of-day (00:00:00.000); `end` to local end-of-day
 * (23:59:59.999). With these bounds, a timestamp comparison
 * `entry >= range.start && entry <= range.end` cleanly includes both the
 * start and end days regardless of the time portion of `entry`. The
 * invariant `start <= end` is always maintained.
 */
export type DateRange = { start: Date; end: Date }

const PRESETS = [
  { id: '1M', label: '1M', months: 1 },
  { id: '3M', label: '3M', months: 3 },
  { id: '6M', label: '6M', months: 6 },
  { id: '1Y', label: '1Y', months: 12 },
  { id: 'ALL', label: 'All', months: null },
] as const

export type PresetId = (typeof PRESETS)[number]['id']

type DateFilterProps = {
  /** Lower bound when the `All` preset is active. Defaults to 2000-01-01. */
  earliestDate?: Date
  /** Preset selected on mount. Defaults to `1M`. */
  defaultPreset?: PresetId
  /** Fires whenever the active range changes (preset click or custom edit). */
  onChange: (range: DateRange) => void
  /** Optional Tailwind classes appended to the root element. */
  className?: string
}

/** Local start-of-day (00:00:00.000) for `d`. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

/** Local end-of-day (23:59:59.999) for `d`. */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

/**
 * Subtract `months` from `d`, clamping the day to the last valid day of
 * the target month when the source day doesn't exist there. Avoids JS's
 * silent rollover (e.g., March 31 → setMonth(-1) producing March 3
 * instead of February 28/29).
 */
export function subtractMonths(d: Date, months: number): Date {
  const targetMonthIndex = d.getMonth() - months
  const result = new Date(d.getFullYear(), targetMonthIndex, d.getDate())
  // The Date constructor normalizes negative/overflowing month indices,
  // but if the target month is shorter than the source day it rolls
  // forward (e.g., Feb 31 → Mar 3). Detect that and snap back to the
  // last day of the target month.
  const expectedMonth = ((targetMonthIndex % 12) + 12) % 12
  if (result.getMonth() !== expectedMonth) {
    result.setDate(0)
  }
  return result
}

/**
 * Compute a `DateRange` for one of the preset buttons. Bounds are
 * day-normalized (start: 00:00, end: 23:59:59.999) so the resulting
 * range is independent of the click time.
 */
export function rangeForPreset(preset: PresetId, earliest: Date): DateRange {
  const today = new Date()
  const end = endOfDay(today)
  if (preset === 'ALL') {
    // Clamp `start` to today if `earliest` is in the future, so the
    // documented `start <= end` invariant survives a future-dated
    // `earliestDate` prop (e.g., a placeholder set before any data lands).
    const earliestStart = startOfDay(earliest)
    return { start: earliestStart > end ? startOfDay(today) : earliestStart, end }
  }
  const months = PRESETS.find((p) => p.id === preset)!.months!
  return { start: startOfDay(subtractMonths(today, months)), end }
}

/** Format a `Date` as `YYYY-MM-DD` for `<input type="date">`. */
export function toInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parse a `YYYY-MM-DD` string from `<input type="date">` as local
 * midnight. Returns `null` for empty input or unparseable values so the
 * caller can no-op rather than storing `Invalid Date`.
 */
export function parseInputValue(s: string): Date | null {
  if (!s) return null
  const d = new Date(`${s}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Convenience predicate for consumers that want a one-liner filter.
 * Inclusive on both ends.
 */
export function isInRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end
}

const EARLIEST_DEFAULT = new Date(2000, 0, 1)

/**
 * `DateFilter` — shared range picker for the Training Facility (Gym detail
 * views, Combine page). Renders a preset pill bar (`1M / 3M / 6M / 1Y / All`)
 * plus a custom range as two `<input type="date">` controls. Preset state is
 * internal; the component is data-shape-agnostic and only emits the active
 * `DateRange` via `onChange`.
 *
 * Editing either date input deselects the preset (custom mode). Clicking a
 * preset overwrites both date inputs. While a preset is active the range
 * re-anchors to the current time when the page becomes visible again, so
 * a tab left open overnight doesn't display stale "today" boundaries.
 *
 * Note for consumers: if `earliestDate` is constructed inline
 * (`new Date(...)` in JSX), each render produces a new reference and the
 * preset-click callback is recreated. Memoize the value (`useMemo`,
 * module-level constant, or a stable selector) when that matters.
 *
 * @component
 * @example
 * ```tsx
 * <DateFilter
 *   earliestDate={new Date('2024-01-01')}
 *   defaultPreset="3M"
 *   onChange={(range) => setVisibleRange(range)}
 * />
 * ```
 */
export const DateFilter: React.FC<DateFilterProps> = ({
  earliestDate = EARLIEST_DEFAULT,
  defaultPreset = '1M',
  onChange,
  className = '',
}) => {
  const [activePreset, setActivePreset] = useState<PresetId | null>(defaultPreset)
  const [range, setRange] = useState<DateRange>(() =>
    rangeForPreset(defaultPreset, earliestDate),
  )

  const selectPreset = useCallback(
    (preset: PresetId) => {
      const next = rangeForPreset(preset, earliestDate)
      setActivePreset(preset)
      setRange(next)
      onChange(next)
    },
    [earliestDate, onChange],
  )

  const updateBound = useCallback(
    (which: 'start' | 'end', date: Date) => {
      // Normalize the new bound to start/end of day so timestamp
      // comparisons against arbitrary entries stay consistent regardless
      // of whether the value came from a preset or a custom input.
      let nextStart = range.start
      let nextEnd = range.end
      if (which === 'start') {
        nextStart = startOfDay(date)
        // If start moved past end, collapse end to the same day.
        if (nextStart > nextEnd) nextEnd = endOfDay(date)
      } else {
        nextEnd = endOfDay(date)
        // If end moved before start, collapse start to the same day.
        if (nextEnd < nextStart) nextStart = startOfDay(date)
      }
      const next: DateRange = { start: nextStart, end: nextEnd }
      setActivePreset(null)
      setRange(next)
      onChange(next)
    },
    [range, onChange],
  )

  // Roving tabindex + arrow / Home / End nav for the radiogroup.
  // Mirrors the WAI-ARIA Authoring Practices for the radio pattern:
  // Tab moves to the group, arrow keys move within.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex = -1
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (index + 1) % PRESETS.length
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (index - 1 + PRESETS.length) % PRESETS.length
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = PRESETS.length - 1
          break
        default:
          return
      }
      e.preventDefault()
      selectPreset(PRESETS[nextIndex].id)
      const sibling = e.currentTarget.parentElement?.children[nextIndex] as
        | HTMLButtonElement
        | undefined
      sibling?.focus()
    },
    [selectPreset],
  )

  // Re-anchor an active preset when the tab becomes visible again, so a
  // session left open overnight doesn't keep yesterday's "today" anchor.
  // Refs keep the listener stable; the prop deps would otherwise cause
  // add/remove churn on every parent rerender if `onChange` isn't memoized.
  const earliestDateRef = useRef(earliestDate)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    earliestDateRef.current = earliestDate
    onChangeRef.current = onChange
  })
  useEffect(() => {
    if (activePreset === null) return
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return
      const next = rangeForPreset(activePreset, earliestDateRef.current)
      setRange(next)
      onChangeRef.current(next)
    }
    document.addEventListener('visibilitychange', refreshIfVisible)
    return () => document.removeEventListener('visibilitychange', refreshIfVisible)
  }, [activePreset])

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${className}`}
      role="group"
      aria-label="Date range filter"
    >
      <div
        className="inline-flex gap-1 rounded-full border border-orange-300/30 bg-black/40 p-1 backdrop-blur-sm"
        role="radiogroup"
        aria-label="Preset ranges"
      >
        {PRESETS.map((p, i) => {
          const active = activePreset === p.id
          // Roving tabindex: the active radio (or the first, when in
          // custom mode and nothing is checked) is the only Tab stop.
          const tabbable =
            activePreset === null
              ? i === 0
              : active
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => selectPreset(p.id)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`cursor-pointer rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wider transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                active ? 'bg-orange-600 text-white' : 'text-neutral-300 hover:bg-neutral-800/70'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={toInputValue(range.start)}
          max={toInputValue(range.end)}
          onChange={(e) => {
            const parsed = parseInputValue(e.target.value)
            if (parsed) updateBound('start', parsed)
          }}
          aria-label="Start date"
          className="cursor-pointer rounded-md border border-orange-300/30 bg-black/40 px-2 py-1 font-mono text-xs text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        />
        <span
          className="font-mono text-xs uppercase tracking-wider text-neutral-500"
          aria-hidden="true"
        >
          →
        </span>
        <input
          type="date"
          value={toInputValue(range.end)}
          min={toInputValue(range.start)}
          onChange={(e) => {
            const parsed = parseInputValue(e.target.value)
            if (parsed) updateBound('end', parsed)
          }}
          aria-label="End date"
          className="cursor-pointer rounded-md border border-orange-300/30 bg-black/40 px-2 py-1 font-mono text-xs text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        />
      </div>
    </div>
  )
}
