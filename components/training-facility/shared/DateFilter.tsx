'use client'

import { useCallback, useState } from 'react'
import React from 'react'

/**
 * Inclusive date range emitted by `DateFilter`. `start` and `end` are
 * concrete `Date` objects in the consumer's local timezone (the date
 * input parses as midnight local). The range is always normalized so
 * `start <= end`.
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

/**
 * Compute a `DateRange` for one of the preset buttons. `today` is captured
 * once at call time so multiple presets stay anchored to the same instant.
 */
function rangeForPreset(preset: PresetId, earliest: Date): DateRange {
  const end = new Date()
  if (preset === 'ALL') return { start: earliest, end }
  const months = PRESETS.find((p) => p.id === preset)!.months!
  const start = new Date()
  start.setMonth(start.getMonth() - months)
  return { start, end }
}

/** Format a `Date` as `YYYY-MM-DD` for `<input type="date">`. */
function toInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a `YYYY-MM-DD` string from `<input type="date">` as local midnight. */
function parseInputValue(s: string): Date {
  return new Date(`${s}T00:00:00`)
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
 * preset overwrites both date inputs.
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
      // Clamp so start <= end. If a bound is dragged past the other, both
      // collapse to the new value rather than producing an inverted range.
      const next: DateRange =
        which === 'start'
          ? { start: date, end: date > range.end ? date : range.end }
          : { start: date < range.start ? date : range.start, end: date }
      setActivePreset(null)
      setRange(next)
      onChange(next)
    },
    [range, onChange],
  )

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${className}`}
      role="group"
      aria-label="Date range filter"
    >
      <div
        className="inline-flex gap-1 rounded-full border border-orange-300/30 bg-black/40 p-1 backdrop-blur-sm"
        role="tablist"
        aria-label="Preset ranges"
      >
        {PRESETS.map((p) => {
          const active = activePreset === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectPreset(p.id)}
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
          onChange={(e) => updateBound('start', parseInputValue(e.target.value))}
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
          onChange={(e) => updateBound('end', parseInputValue(e.target.value))}
          aria-label="End date"
          className="cursor-pointer rounded-md border border-orange-300/30 bg-black/40 px-2 py-1 font-mono text-xs text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        />
      </div>
    </div>
  )
}
