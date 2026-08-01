import type { JSX } from 'react'

import {
  formatFocusWindow,
  type FocusAdherence,
  type FocusLoadStats,
} from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'
import { exerciseLabel } from '@/lib/training-facility/exercise-labels'

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
          {exerciseLabel(focus)}
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
          <FocusStat
            label="Top set"
            value={`${trim1(loadStats.topSetLbs ?? 0)} lb`}
            sub={totalLoadNote(loadStats.topSetLbs, loadStats.loadMultiplier)}
          />
          <FocusStat
            label="Avg load"
            value={`${trim1(loadStats.avgLoadLbs ?? 0)} lb`}
            sub={totalLoadNote(loadStats.avgLoadLbs, loadStats.loadMultiplier)}
          />
          {/* Tonnage already counts every implement, so it needs no second reading. */}
          <FocusStat label="Tonnage" value={`${loadStats.tonnageLbs.toLocaleString()} lb`} />
        </dl>
      ) : null}
    </div>
  )
}

/**
 * The second reading of a load for a multi-implement movement, e.g. `×2 · 120 lb`
 * under a `60 lb` top set.
 *
 * `topSetLbs` / `avgLoadLbs` are per *implement* — the number stamped on one
 * dumbbell, which is how the load is read off the rack and how it gets logged.
 * That's the right answer to "how heavy did you go", but it leaves "how much was
 * actually in my hands" unstated, and the Trophy Room's load badges are keyed to
 * that total. Showing both here means neither surface has to be translated.
 *
 * @returns `undefined` for a single-implement movement, where the two readings
 *   are the same number and a second line would be noise.
 */
function totalLoadNote(perImplementLbs: number | null, loadMultiplier: number): string | undefined {
  if (perImplementLbs === null || loadMultiplier <= 1) return undefined
  return `×${loadMultiplier} · ${trim1(perImplementLbs * loadMultiplier)} lb`
}

/** Single labelled stat cell inside the focus card's grids. */
function FocusStat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  /** Optional secondary reading rendered under the value, e.g. a total-load note. */
  sub?: string
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <dd className="font-mono text-base font-semibold tabular-nums text-white">
        {value}
        {sub ? (
          <span className="mt-0.5 block text-[9px] font-normal tracking-[0.08em] text-white/45">
            {sub}
          </span>
        ) : null}
      </dd>
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">{label}</dt>
    </div>
  )
}
