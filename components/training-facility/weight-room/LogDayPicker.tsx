'use client'

import { useId, type JSX } from 'react'

import { formatDayLabel } from '@/lib/training-facility/strength-today'

/** Props for {@link LogDayPicker}. */
export interface LogDayPickerProps {
  /**
   * Currently selected `YYYY-MM-DD` day key. The Log view's rings,
   * set list, and new-set `logged_at` all follow this value.
   */
  selectedDay: string
  /**
   * Today's `YYYY-MM-DD` key in the viewer's local timezone. Doubles
   * as the date input's `max` (no logging into the future) and as the
   * reference for "are we backfilling?" — the reset chip and the
   * viewing indicator only render when `selectedDay !== todayKey`.
   */
  todayKey: string
  /**
   * Called with the new `YYYY-MM-DD` key when the user picks a date or
   * taps "Back to today". Never called with an empty or future value —
   * the component swallows those instead of forwarding them.
   */
  onSelectDay: (dayKey: string) => void
}

/**
 * Sticky day selector for the admin Log view (#202). Defaults to today;
 * picking a past day switches the whole view (rings, totals, set list)
 * to that day and stamps newly logged sets onto it, so a workout done
 * yesterday can be filed under yesterday instead of polluting today's
 * rings.
 *
 * Native `<input type="date">` so mobile gets the platform date picker
 * for free. `max` blocks future days in the picker UI; typed future
 * dates are dropped in the change handler as well.
 */
export function LogDayPicker({
  selectedDay,
  todayKey,
  onSelectDay,
}: LogDayPickerProps): JSX.Element {
  const inputId = useId()
  const isBackfilling = selectedDay !== todayKey

  return (
    <div
      data-testid="log-day-picker"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
    >
      <label
        htmlFor={inputId}
        className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80"
      >
        Logging day
      </label>
      <input
        id={inputId}
        type="date"
        value={selectedDay}
        max={todayKey}
        onChange={(e) => {
          const next = e.target.value
          // Ignore anything that isn't a strict YYYY-MM-DD key (cleared
          // input, exotic 5+-digit years) and typed future dates — the
          // controlled value snaps the input back to the last valid day.
          // Lexicographic compare is safe once the shape is pinned.
          if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next > todayKey) return
          onSelectDay(next)
        }}
        data-testid="log-day-input"
        className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white [color-scheme:dark] focus:border-amber-300/60 focus:outline-none"
      />
      {isBackfilling ? (
        <>
          <button
            type="button"
            onClick={() => onSelectDay(todayKey)}
            data-testid="log-day-reset"
            className="min-h-[40px] rounded-full border border-amber-200/30 bg-amber-200/10 px-4 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20"
          >
            Back to today
          </button>
          <p
            role="status"
            data-testid="log-day-indicator"
            className="basis-full font-mono text-[12px] text-amber-200/90"
          >
            Viewing {formatDayLabel(selectedDay)} — new sets will be logged
            to this day.
          </p>
        </>
      ) : null}
    </div>
  )
}
