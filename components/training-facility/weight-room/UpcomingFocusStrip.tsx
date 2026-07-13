import type { JSX } from 'react'

import { formatFocusWindow } from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'

/** Props for {@link UpcomingFocusStrip}. */
export interface UpcomingFocusStripProps {
  /**
   * Upcoming focuses, soonest first — caller resolves via
   * `upcomingFocuses`. The strip renders nothing when this is empty.
   */
  focuses: readonly MonthlyFocus[]
}

/**
 * "Up Next" roadmap strip for the Weight Room Log View (#255). Lists the
 * queued "grease the groove" focuses so the rotation is visible before it
 * starts — answering "what's coming after this month?". Renders `null`
 * when nothing is queued, so the caller can drop it in unconditionally.
 */
export function UpcomingFocusStrip({ focuses }: UpcomingFocusStripProps): JSX.Element | null {
  if (focuses.length === 0) return null

  return (
    <div
      data-testid="upcoming-focus-strip"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">
        Up Next
      </span>
      {focuses.map((focus) => (
        <span
          key={focus.id}
          data-testid={`upcoming-focus-${focus.exercise}`}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: focus.color }} />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
            {focus.exercise}
          </span>
          <span
            data-testid={`upcoming-focus-${focus.exercise}-category`}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45"
          >
            {focus.category}
          </span>
          <span
            data-testid={`upcoming-focus-${focus.exercise}-window`}
            className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-white/45"
          >
            {formatFocusWindow(focus)}
          </span>
        </span>
      ))}
    </div>
  )
}
