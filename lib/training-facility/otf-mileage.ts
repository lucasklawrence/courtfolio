/**
 * Pure monthly-mileage helpers for the OrangeTheory view (#321).
 *
 * "Marathon month" tracking: total the miles you cover at OTF each calendar
 * month (treadmill distance + rower distance) and light up milestone badges
 * (half marathon, marathon, ultra…) as the month's total crosses each
 * threshold. A paid app tracks this; we do it for free off the session data
 * we already ingest.
 *
 * This module is pure and isomorphic — it imports no Supabase client and no
 * React — so it unit-tests cleanly and runs on either side of the SSR/CSR
 * boundary. The milestone ladder ({@link OtfMileageAward}) is data-driven,
 * loaded from `otf_mileage_awards` and editable in the admin settings page;
 * nothing here hardcodes a threshold.
 *
 * Distance provenance mirrors the rest of the OTF layer: treadmill distance
 * is already miles (`treadmill.distance_mi`), rower distance is meters
 * (`rower.distance_m`) and is converted here. Excluded/anomalous sessions
 * (#268) are dropped before any total, exactly as the charts and highlights
 * drop them.
 */

import type { OtfMileageAward, OtfSession } from '@/types/otf'

import { excludeInvalidOtfSessions, otfSessionDate } from './otf'

/** Meters per statute mile — the rower reports `distance_m`, milestones are in miles. */
export const METERS_PER_MILE = 1609.344

/** Month names for {@link monthLabelOf}, indexed 0 (January) – 11 (December). */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/**
 * Miles covered in a single session: treadmill miles plus rower meters
 * converted to miles. A session missing either machine contributes 0 for that
 * machine, so a tread-only or row-only class still totals correctly. Does not
 * consider `excluded` — callers filter first (see {@link monthlyOtfMileage}).
 */
export function sessionMiles(session: OtfSession): number {
  const treadMiles = session.treadmill?.distance_mi ?? 0
  const rowerMiles = (session.rower?.distance_m ?? 0) / METERS_PER_MILE
  return treadMiles + rowerMiles
}

/**
 * Local-timezone `YYYY-MM` bucket key for a date. Uses the viewer's local
 * calendar month (via {@link otfSessionDate}'s `Date`), matching how the OTF
 * day-bucketing helpers treat session dates, so a late-night class counts in
 * the month the user experienced it, not the UTC month.
 */
export function monthKeyOf(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Human month label like `"July 2026"` from a 0-based month index and full year. */
export function monthLabelOf(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`
}

/**
 * One calendar month's OTF mileage total.
 *
 * @property monthKey   Local-tz `YYYY-MM` sort/identity key.
 * @property year       Local-tz calendar year.
 * @property monthIndex 0-based month (0 = January).
 * @property label      Display label, e.g. `"July 2026"`.
 * @property miles      Summed treadmill + rower miles for the month (excluded sessions dropped).
 * @property classes    Number of counted (non-excluded) sessions in the month.
 */
export interface MonthlyMileage {
  monthKey: string
  year: number
  monthIndex: number
  label: string
  miles: number
  classes: number
}

/**
 * Total OTF miles per calendar month, newest month first.
 *
 * Excluded/anomalous sessions (#268) are dropped before totaling. Months with
 * no counted sessions do not appear — the total is built from the data, so an
 * inactive month is simply absent (the view synthesizes a zero row for the
 * *current* month via {@link buildOtfMileageView}). Bucketing is by local-tz
 * calendar month (see {@link monthKeyOf}).
 */
export function monthlyOtfMileage(sessions: readonly OtfSession[]): MonthlyMileage[] {
  const byMonth = new Map<string, MonthlyMileage>()

  for (const session of excludeInvalidOtfSessions(sessions)) {
    const date = otfSessionDate(session)
    const monthKey = monthKeyOf(date)
    const existing = byMonth.get(monthKey)
    if (existing) {
      existing.miles += sessionMiles(session)
      existing.classes += 1
    } else {
      byMonth.set(monthKey, {
        monthKey,
        year: date.getFullYear(),
        monthIndex: date.getMonth(),
        label: monthLabelOf(date.getFullYear(), date.getMonth()),
        miles: sessionMiles(session),
        classes: 1,
      })
    }
  }

  return [...byMonth.values()].sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))
}

/**
 * A month's mileage total resolved against the milestone ladder.
 *
 * @property earned         Tiers whose threshold the month's miles have reached, low → high.
 * @property next           Lowest not-yet-earned tier, or `null` when every tier is earned (or the ladder is empty).
 * @property remainingToNext Miles still needed to reach {@link next}, or `null` when there is no next tier.
 */
export interface AwardProgress {
  earned: OtfMileageAward[]
  next: OtfMileageAward | null
  remainingToNext: number | null
}

/**
 * Resolve a mileage total against the milestone ladder: which tiers are
 * earned, the next one to chase, and how far off it is. Stateless — a pure
 * function of the total and the ladder, recomputed each render (#321), so
 * nothing is persisted per month and editing a tier's threshold re-lights the
 * badges immediately.
 *
 * A tier counts as earned at `miles >= threshold` (hitting the marathon line
 * exactly earns it). The ladder is sorted ascending defensively so callers may
 * pass it in any order.
 */
export function resolveAwards(
  miles: number,
  awards: readonly OtfMileageAward[],
): AwardProgress {
  const ladder = [...awards].sort((a, b) => a.miles - b.miles)
  const earned = ladder.filter((award) => miles >= award.miles)
  const next = ladder.find((award) => award.miles > miles) ?? null
  return {
    earned,
    next,
    remainingToNext: next ? next.miles - miles : null,
  }
}

/** A month's mileage total with its milestone ladder already resolved. */
export interface AwardedMonth extends MonthlyMileage, AwardProgress {}

/**
 * The mileage section's full display model (#321): the current calendar month
 * as a headline plus the scrollable history of prior months.
 *
 * @property current The current calendar month, always present — synthesized as
 *   a zero-mile month when no class has been logged yet this month, so the
 *   headline card and its "miles to your first badge" progress always render.
 * @property history Prior months with logged mileage, newest first. Excludes the
 *   current month (it's the headline). A month dated in the future relative to
 *   `now` (clock skew / bad data) sorts to the top of history rather than the
 *   headline.
 */
export interface OtfMileageView {
  current: AwardedMonth
  history: AwardedMonth[]
}

/** Attach resolved award progress to a {@link MonthlyMileage} row. */
function awardMonth(month: MonthlyMileage, awards: readonly OtfMileageAward[]): AwardedMonth {
  return { ...month, ...resolveAwards(month.miles, awards) }
}

/**
 * Build the mileage section's display model from raw sessions, the milestone
 * ladder, and the current time.
 *
 * `now` is injected (not read from the clock here) to keep this pure and
 * testable; the client component passes `new Date()`. The current calendar
 * month is always returned as {@link OtfMileageView.current} — with its real
 * total when classes exist, or a zero row otherwise — and every other month
 * with logged mileage falls into {@link OtfMileageView.history}, newest first.
 *
 * @param sessions Raw OTF sessions (excluded ones are dropped internally).
 * @param awards   The milestone ladder; may be empty (no badges, no next tier).
 * @param now      The reference "current" time, in the viewer's local timezone.
 */
export function buildOtfMileageView(
  sessions: readonly OtfSession[],
  awards: readonly OtfMileageAward[],
  now: Date,
): OtfMileageView {
  const months = monthlyOtfMileage(sessions)
  const currentKey = monthKeyOf(now)

  const currentMonth =
    months.find((month) => month.monthKey === currentKey) ??
    ({
      monthKey: currentKey,
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      label: monthLabelOf(now.getFullYear(), now.getMonth()),
      miles: 0,
      classes: 0,
    } satisfies MonthlyMileage)

  const history = months
    .filter((month) => month.monthKey !== currentKey)
    .map((month) => awardMonth(month, awards))

  return { current: awardMonth(currentMonth, awards), history }
}
