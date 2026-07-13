import type { JSX } from 'react'

import {
  formatFocusWindow,
  type FocusAdherence,
  type FocusLoadStats,
} from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'

/** Props for {@link MonthlyFocusCard}. */
export interface MonthlyFocusCardProps {
  /** The active focus to display (caller resolves it via `activeFocusesForDay`). */
  focus: MonthlyFocus
  /**
   * The focus exercise's total for the viewed day — reps when
   * `focus.target_kind === 'reps'`, distinct sets when `'sets'`. Drives
   * the "today" progress readout against {@link MonthlyFocus.daily_target}.
   */
  todayProgress: number
  /** Windowed adherence from `computeFocusAdherence`. */
  adherence: FocusAdherence
  /** Load summary from `computeFocusLoadStats`; metrics are null when bodyweight. */
  loadStats: FocusLoadStats
}

/** Round to one decimal and strip a trailing `.0` so 95.0 reads "95". */
function trim1(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

/**
 * "Focus of the Month" card for the Weight Room Log View (#255). Surfaces
 * the active "grease the groove" campaign: today's progress toward the
 * daily target, the campaign's calendar window (e.g. `Jul 1 – Jul 31`),
 * windowed adherence (day N of the month, days hit, current streak), and —
 * for weighted focuses like shrugs — load stats (top set, average load,
 * tonnage).
 *
 * Renders nothing about load when the focus is bodyweight
 * (`loadStats.weightedSets === 0`), so a calisthenics focus doesn't show
 * an empty "0 lbs" strip. The focus color tints the accent chrome so the
 * card reads as its own lane alongside the permanent rings.
 */
export function MonthlyFocusCard({
  focus,
  todayProgress,
  adherence,
  loadStats,
}: MonthlyFocusCardProps): JSX.Element {
  const unit = focus.target_kind === 'sets' ? 'sets' : 'reps'
  const metGoal = todayProgress >= focus.daily_target
  const dayOfWindow = Math.min(adherence.daysElapsed, adherence.daysInWindow)
  const hasLoad = loadStats.weightedSets > 0
  const categoryLabel = focus.category === 'lower' ? 'Lower Focus' : 'Upper Focus'

  return (
    <div
      data-testid={`monthly-focus-${focus.exercise}`}
      className="flex flex-col gap-4 rounded-[1.4rem] border border-white/10 bg-white/5 p-5"
      style={{ boxShadow: `inset 3px 0 0 0 ${focus.color}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/55">
          {categoryLabel}
        </span>
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: focus.color }}
        >
          {focus.exercise}
        </span>
      </div>

      {/* Today's progress toward the daily target. */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums text-white">
          {todayProgress}
        </span>
        <span className="font-mono text-sm text-white/55">
          / {focus.daily_target} {unit} today
        </span>
        {metGoal ? (
          <span aria-hidden="true" className="ml-auto text-lg" title="Daily target met">
            {'✅'}
          </span>
        ) : null}
      </div>

      {/* Campaign window + windowed adherence. */}
      <div className="flex flex-col gap-3">
        <span
          data-testid={`monthly-focus-${focus.exercise}-window`}
          className="text-center font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums text-white/45"
        >
          {formatFocusWindow(focus)}
        </span>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <FocusStat label="Day" value={`${dayOfWindow}/${adherence.daysInWindow}`} />
          <FocusStat label="Days hit" value={`${adherence.daysHit}`} />
          <FocusStat label="Streak" value={`${adherence.currentStreak}d`} />
        </dl>
      </div>

      {/* Load stats — only for weighted focuses. */}
      {hasLoad ? (
        <dl className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-center">
          <FocusStat label="Top set" value={`${trim1(loadStats.topSetLbs ?? 0)} lb`} />
          <FocusStat label="Avg load" value={`${trim1(loadStats.avgLoadLbs ?? 0)} lb`} />
          <FocusStat label="Tonnage" value={`${loadStats.tonnageLbs.toLocaleString()} lb`} />
        </dl>
      ) : null}
    </div>
  )
}

/** Single labelled stat cell inside the focus card's grids. */
function FocusStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <dd className="font-mono text-base font-semibold tabular-nums text-white">{value}</dd>
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">{label}</dt>
    </div>
  )
}
