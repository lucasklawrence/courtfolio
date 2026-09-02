'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'

import {
  EARLIEST_DEFAULT,
  PRESETS,
  endOfDay,
  parseInputValue,
  rangeForPreset,
  startOfDay,
  toInputValue,
  type DateRange,
  type PresetId,
} from '@/lib/training-facility/date-range'

/**
 * Re-exported for the surfaces that have always imported the range vocabulary
 * from this component (#425). The definitions now live in
 * `lib/training-facility/date-range.ts` — a domain module that reaches for a
 * React component to get `startOfDay` had the dependency arrow backwards.
 */
export {
  EARLIEST_DEFAULT,
  PRESETS,
  endOfDay,
  isInRange,
  parseInputValue,
  rangeForPreset,
  startOfDay,
  subtractMonths,
  toInputValue,
  type DateRange,
  type PresetId,
} from '@/lib/training-facility/date-range'

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
  const [range, setRange] = useState<DateRange>(() => rangeForPreset(defaultPreset, earliestDate))

  const selectPreset = useCallback(
    (preset: PresetId) => {
      const next = rangeForPreset(preset, earliestDate)
      setActivePreset(preset)
      setRange(next)
      onChange(next)
    },
    [earliestDate, onChange]
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
    [range, onChange]
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
        HTMLButtonElement | undefined
      sibling?.focus()
    },
    [selectPreset]
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
          const tabbable = activePreset === null ? i === 0 : active
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => selectPreset(p.id)}
              onKeyDown={e => handleKeyDown(e, i)}
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
          onChange={e => {
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
          onChange={e => {
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
