import Link from 'next/link'
import { useMemo, type CSSProperties, type JSX } from 'react'

import {
  buildOtfMileageView,
  type AwardedMonth,
} from '@/lib/training-facility/otf-mileage'
import type { OtfMileageAward, OtfSession } from '@/types/otf'

/** Fallback accent for a milestone tier with no configured `color`. */
const DEFAULT_AWARD_COLOR = '#F97316'

/** Props for {@link OtfMileageSection}. */
export interface OtfMileageSectionProps {
  /**
   * All OTF sessions, unfiltered. This section is intentionally independent of
   * the page's date/class filters — it always reports the current calendar
   * month plus the full month history — so it takes the raw session list, not
   * the filtered one.
   */
  sessions: readonly OtfSession[]
  /** The milestone ladder from `otf_mileage_awards`; may be empty (no badges). */
  awards: readonly OtfMileageAward[]
  /** When true, render the admin-only link to the milestone settings editor. */
  isAdmin?: boolean
  /**
   * Reference "current" time, injected for deterministic tests. Defaults to the
   * render-time clock in the browser.
   */
  now?: Date
}

/** Miles formatted to one decimal — the display precision for every total. */
function formatMiles(miles: number): string {
  return miles.toFixed(1)
}

/**
 * Monthly OTF mileage tracker (#321) — "marathon month" without the paid app.
 *
 * Sums each calendar month's treadmill + rower miles and lights up milestone
 * badges (half marathon, marathon, ultra…) as the month's total crosses each
 * configurable threshold. The current month is the headline (miles-to-date and
 * progress toward the next badge); prior months scroll below. Excluded/anomalous
 * sessions (#268) are dropped by {@link buildOtfMileageView}. Filter-independent
 * by design — see {@link OtfMileageSectionProps.sessions}.
 */
export function OtfMileageSection({
  sessions,
  awards,
  isAdmin = false,
  now,
}: OtfMileageSectionProps): JSX.Element {
  // `now` defaults to the render clock; folded into the memo so tests that pass
  // an explicit `now` stay deterministic while the live view tracks the date.
  const view = useMemo(
    () => buildOtfMileageView(sessions, awards, now ?? new Date()),
    [sessions, awards, now],
  )
  const { current, history } = view

  return (
    <section
      data-testid="otf-mileage-section"
      aria-label="Monthly OTF mileage"
      className="mt-8 rounded-[1.4rem] border border-[#f97316]/20 bg-white/[0.03] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#f97316]">
            Marathon month
          </p>
          <h2 className="mt-1 text-lg font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-xl">
            Monthly mileage
          </h2>
        </div>
        {isAdmin ? (
          <Link
            href="/training-facility/gym/otf/settings"
            className="rounded-full border border-[#f97316]/40 bg-[#f97316]/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#f9a870] transition hover:bg-[#f97316]/20"
          >
            Milestones
          </Link>
        ) : null}
      </div>

      <CurrentMonthCard month={current} />

      <div className="mt-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
          Earlier months
        </h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-[#e8d5be]/60">No earlier months logged yet.</p>
        ) : (
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
            {history.map((month) => (
              <HistoryRow key={month.monthKey} month={month} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/** The current calendar month: miles-to-date, earned badges, and progress to next. */
function CurrentMonthCard({ month }: { month: AwardedMonth }): JSX.Element {
  const { label, miles, classes, earned, next, remainingToNext } = month
  const pct =
    next && next.miles > 0 ? Math.min(100, Math.round((miles / next.miles) * 100)) : 100

  return (
    <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-black/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/60">
          {label}
        </p>
        <p className="text-sm text-white/50">
          {classes} {classes === 1 ? 'class' : 'classes'}
        </p>
      </div>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-black tabular-nums text-[#fff7ec] sm:text-5xl">
          {formatMiles(miles)}
        </span>
        <span className="font-mono text-sm uppercase tracking-[0.2em] text-[#f9a870]">miles</span>
      </p>

      {earned.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Milestones earned this month">
          {earned.map((award) => (
            <AwardBadge key={award.id} award={award} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#e8d5be]/60">No milestone yet this month.</p>
      )}

      {next ? (
        <div className="mt-4">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress to ${next.label}`}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: next.color ?? DEFAULT_AWARD_COLOR }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
            {formatMiles(remainingToNext ?? 0)} mi to {next.label}
          </p>
        </div>
      ) : earned.length > 0 ? (
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#f9a870]">
          Every milestone cleared 🎉
        </p>
      ) : null}
    </div>
  )
}

/** One prior month as a compact row: label, miles, and its earned-badge chips. */
function HistoryRow({ month }: { month: AwardedMonth }): JSX.Element {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[0.9rem] border border-white/5 bg-white/[0.02] px-3 py-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">
        {month.label}
      </span>
      <span className="tabular-nums text-sm font-semibold text-[#fff7ec]">
        {formatMiles(month.miles)} mi
      </span>
      {month.earned.length > 0 ? (
        <span className="ml-auto flex flex-wrap gap-1.5">
          {month.earned.map((award) => (
            <AwardBadge key={award.id} award={award} compact />
          ))}
        </span>
      ) : null}
    </li>
  )
}

/** A milestone badge chip tinted with the tier's configured accent color. */
function AwardBadge({
  award,
  compact = false,
}: {
  award: OtfMileageAward
  compact?: boolean
}): JSX.Element {
  const color = award.color ?? DEFAULT_AWARD_COLOR
  const style: CSSProperties = { borderColor: color, color }
  return (
    <span
      style={style}
      className={
        compact
          ? 'rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]'
          : 'rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]'
      }
    >
      {award.label}
    </span>
  )
}
