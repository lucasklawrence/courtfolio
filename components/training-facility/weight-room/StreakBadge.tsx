import type { JSX } from 'react'

import type { StrengthStreakResult } from '@/lib/training-facility/strength-streaks'

/** Props for {@link StreakBadge}. */
export interface StreakBadgeProps {
  /** Display name for the exercise (e.g. `pushups`). Rendered uppercased. */
  exercise: string
  /** Active and longest streak counts, from `computeStrengthStreaks`. */
  streak: StrengthStreakResult
  /**
   * Hex color for the active flame's background tint. Pulled from the
   * exercise's {@link import('@/types/weight-room').ExerciseGoal.color}
   * so each lane reads as its own visual identity. Falls back to amber
   * when omitted (matches the rest of the Weight Room chrome).
   */
  accentColor?: string
}

const DEFAULT_ACCENT = '#fbbf24'

/**
 * Per-exercise streak indicator for the Today View (#80, sub-component
 * of TodayView). Sibling of the cardio
 * {@link import('@/components/training-facility/gym/StreakCounter').StreakCounter}
 * but scaled down to a chip-sized badge — the Today View shows one of
 * these per exercise alongside the activity rings, so the chrome has
 * to stay tight.
 *
 * The flame goes desaturated when the current streak is 0 so an
 * inactive run doesn't fight the rest of the page for attention.
 * Long-streak callout (`+ longest 12d`) only renders when longest > 0
 * so a freshly-set goal doesn't say "longest 0d".
 */
export function StreakBadge({
  exercise,
  streak,
  accentColor = DEFAULT_ACCENT,
}: StreakBadgeProps): JSX.Element {
  const isActive = streak.current > 0
  return (
    <div
      data-testid={`streak-badge-${exercise}`}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`text-lg ${isActive ? '' : 'opacity-40 grayscale'}`}
          style={isActive ? { filter: `drop-shadow(0 0 4px ${accentColor}88)` } : undefined}
        >
          {'\u{1F525}'}
        </span>
        <div className="flex flex-col leading-none">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
            {exercise}
          </span>
          <span className="mt-0.5 font-mono text-base font-semibold tabular-nums text-white">
            {streak.current}
            <span className="ml-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
              day{streak.current === 1 ? '' : 's'}
            </span>
          </span>
        </div>
      </div>
      {streak.longest > 0 ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
          longest{' '}
          <span className="font-semibold tabular-nums text-white/80">{streak.longest}d</span>
        </span>
      ) : null}
    </div>
  )
}
