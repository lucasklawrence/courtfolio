import type { JSX } from 'react'

import type { StreakResult } from '@/lib/training-facility/streaks'

/** Props for {@link StreakCounter}. */
export interface StreakCounterProps {
  /** All-time current and longest streaks (computed from `data.sessions`). */
  streak: StreakResult
  /**
   * Streak result for sessions filtered by the active `DateFilter` range.
   * Pass `null` (or omit) when no range is active — the component renders
   * only the all-time numbers in that case. When provided, the longest
   * streak in the range is shown alongside the all-time numbers.
   */
  filteredStreak?: StreakResult | null
  /**
   * Optional Tailwind classes appended to the outer card. Lets the parent
   * tweak grid placement / width without rewriting the card chrome.
   */
  className?: string
}

/**
 * Compact streak indicator for the All Cardio Overview, ported from the
 * standalone cardio-dashboard repo (slice B of #75) and re-styled to the
 * cream-card aesthetic that `SummaryRow` uses elsewhere on the page.
 *
 * Renders three stat columns inside one card: 🔥 current, longest (all
 * time), and longest in the active filter range. The flame goes
 * desaturated when the current streak is 0 so an inactive run doesn't
 * fight the rest of the page for attention.
 */
export function StreakCounter({
  streak,
  filteredStreak,
  className = '',
}: StreakCounterProps): JSX.Element {
  const isActive = streak.current > 0
  return (
    <section
      aria-label="Workout streaks"
      data-testid="streak-counter"
      className={`rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-4 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)] ${className}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-3">
          <span aria-hidden="true" className={`text-2xl ${isActive ? '' : 'opacity-30 grayscale'}`}>
            {'\u{1F525}'}
          </span>
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums">{streak.current}</p>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0a0a0a]/70">
              day streak
            </p>
          </div>
        </div>

        <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/70">
          longest{' '}
          <span className="font-semibold tabular-nums text-[#0a0a0a]">{streak.longest}d</span>
        </div>

        {filteredStreak && filteredStreak.longest > 0 ? (
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/70">
            in range{' '}
            <span className="font-semibold tabular-nums text-[#0a0a0a]">
              {filteredStreak.longest}d
            </span>
          </div>
        ) : null}
      </div>
    </section>
  )
}
