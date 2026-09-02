'use client'

import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import {
  formatFocusWindow,
  type FocusAdherence,
  type FocusLoadStats,
} from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'
import { exerciseLabel } from '@/lib/training-facility/exercise-labels'

// ---------------------------------------------------------------------------
// Ring animation constants
// ---------------------------------------------------------------------------

/** Radius of the adherence ring arc in SVG user-units. */
const RING_RADIUS = 36
/** `2π × RING_RADIUS` — full stroke length for `stroke-dasharray`. */
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

// ---------------------------------------------------------------------------
// Internal helpers (shared with MonthlyFocusCard pattern)
// ---------------------------------------------------------------------------

/** Round to one decimal and strip a trailing `.0` so `95.0` reads `"95"`. */
function trim1(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

/**
 * The second reading of a load for a multi-implement movement, e.g. `×2 · 120 lb`
 * under a `60 lb` top set.
 *
 * `topSetLbs` / `avgLoadLbs` are per *implement* — how the load is read off the
 * equipment. "How much was actually in my hands" isn't stated until multiplied.
 * Showing both here means neither surface has to be translated.
 *
 * @returns `undefined` for a single-implement movement, where the two readings
 *   are the same number and a second line would be noise.
 */
function totalLoadNote(perImplementLbs: number | null, loadMultiplier: number): string | undefined {
  if (perImplementLbs === null || loadMultiplier <= 1) return undefined
  return `×${loadMultiplier} · ${trim1(perImplementLbs * loadMultiplier)} lb`
}

/** Single labelled stat cell inside the focus card's `<dl>` grids. */
function FocusStat({
  label,
  value,
  sub,
}: {
  /** Label rendered under the value. */
  label: string
  /** Primary metric value. */
  value: string
  /** Optional secondary reading rendered under the value, e.g. total-load note. */
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Props for {@link PastFocusCard}. */
export interface PastFocusCardProps {
  /** The focus to display — may be active or fully elapsed. */
  focus: MonthlyFocus
  /** Windowed adherence computed by `computeFocusAdherence`. */
  adherence: FocusAdherence
  /** Load summary computed by `computeFocusLoadStats`. Null metrics shown when bodyweight. */
  loadStats: FocusLoadStats
}

/**
 * History-page card for one GTG rotation segment (#361). Shows an animated
 * SVG adherence ring (overall days-hit rate), the campaign window, days hit
 * vs elapsed, current streak, and — for weighted focuses — top set, average
 * load, and tonnage.
 *
 * Uses `'use client'` for the `requestAnimationFrame`-triggered ring
 * animation. Everything else is static data passed down from the Server
 * Component page, so no fetch or subscription occurs in this component.
 */
export function PastFocusCard({ focus, adherence, loadStats }: PastFocusCardProps): JSX.Element {
  // Drive the ring animation from 0% → adherence.percent on mount.
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    // One rAF defers the state flip just past the browser's first paint so
    // the CSS transition actually runs (setting state synchronously on mount
    // would skip the from-state entirely).
    const raf = requestAnimationFrame(() => setAnimated(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const pct = Math.min(1, adherence.percent)
  const dashoffset = RING_CIRCUMFERENCE * (1 - (animated ? pct : 0))
  const unit = focus.target_kind === 'sets' ? 'sets' : 'reps'
  const categoryLabel = focus.category === 'lower' ? 'Lower Focus' : 'Upper Focus'
  const hasLoad = loadStats.weightedSets > 0

  return (
    <div
      data-testid={`past-focus-${focus.exercise}`}
      className="flex gap-4 rounded-[1.4rem] border border-white/10 bg-white/5 p-5"
      style={{ boxShadow: `inset 3px 0 0 0 ${focus.color}` }}
    >
      {/* Animated adherence ring */}
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <svg
          width={88}
          height={88}
          viewBox="0 0 88 88"
          role="img"
          aria-label={`${Math.round(pct * 100)}% adherence for ${exerciseLabel(focus)}`}
        >
          {/* Background track */}
          <circle
            cx={44}
            cy={44}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(247,234,217,0.07)"
            strokeWidth={7}
          />
          {/* Animated progress arc */}
          <circle
            cx={44}
            cy={44}
            r={RING_RADIUS}
            fill="none"
            stroke={focus.color}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 44 44)"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
          {/* Percentage label */}
          <text
            x={44}
            y={44}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={14}
            fontWeight="bold"
            fill="white"
          >
            {Math.round(pct * 100)}%
          </text>
        </svg>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
          adherence
        </span>
      </div>

      {/* Stats panel */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* Exercise label + category chip */}
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

        {/* Window + daily target */}
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] tabular-nums text-white/45">
          {formatFocusWindow(focus)} · {focus.daily_target} {unit}/day
        </span>

        {/* Adherence stats */}
        <dl className="grid grid-cols-3 gap-3 text-center">
          <FocusStat label="Days hit" value={`${adherence.daysHit}/${adherence.daysElapsed}`} />
          <FocusStat label="Streak" value={`${adherence.currentStreak}d`} />
          <FocusStat label="Window" value={`${adherence.daysInWindow}d`} />
        </dl>

        {/* Load stats — only for weighted focuses */}
        {hasLoad ? (
          <dl className="grid grid-cols-3 gap-3 border-t border-white/10 pt-3 text-center">
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
            <FocusStat label="Tonnage" value={`${loadStats.tonnageLbs.toLocaleString()} lb`} />
          </dl>
        ) : null}
      </div>
    </div>
  )
}
