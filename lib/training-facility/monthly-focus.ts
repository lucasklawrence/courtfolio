import type { MonthlyFocus, StrengthSet } from '@/types/weight-room'

import { toLocalDateKey } from './strength-today'

/**
 * Pure helpers for the "grease the groove" monthly focus (#255) — which
 * focus is active on a given day, which are still upcoming, windowed
 * adherence, and load stats for weighted focuses. Kept separate from the
 * React surfaces so the date/window math is unit-tested without a DOM,
 * mirroring `strength-today.ts` / `strength-streaks.ts`.
 *
 * All window math compares bare `YYYY-MM-DD` keys. PostgREST renders a
 * Postgres `date` in that canonical form, and `toLocalDateKey` produces
 * it for set timestamps, so lexicographic string comparison is exactly
 * chronological comparison — no `Date` parsing (and no UTC-midnight
 * timezone hazard) needed for the inclusive `start <= day <= end` test.
 */

/**
 * Whether a focus window covers `dayKey` (inclusive on both ends).
 *
 * @param focus The focus whose `[start_date, end_date]` window to test.
 * @param dayKey `YYYY-MM-DD` key, e.g. from {@link toLocalDateKey}. An
 *   empty string (unparseable "today") is never in-window.
 */
export function isFocusActiveOnDay(focus: MonthlyFocus, dayKey: string): boolean {
  if (dayKey === '') return false
  return focus.start_date <= dayKey && dayKey <= focus.end_date
}

/**
 * The single focus active on `dayKey`, or `null` if none. When more than
 * one window overlaps the day (not expected — focuses are meant to be a
 * non-overlapping monthly rotation), the one that started most recently
 * wins, so a deliberately-overlapping replacement takes precedence.
 *
 * @param focuses All configured focuses, usually `WeightRoomData.monthly_focus`.
 * @param dayKey `YYYY-MM-DD` key for the viewed day.
 */
export function activeFocusForDay(
  focuses: readonly MonthlyFocus[],
  dayKey: string,
): MonthlyFocus | null {
  let active: MonthlyFocus | null = null
  for (const focus of focuses) {
    if (!isFocusActiveOnDay(focus, dayKey)) continue
    if (active === null || focus.start_date > active.start_date) {
      active = focus
    }
  }
  return active
}

/**
 * Focuses whose window starts strictly after `dayKey`, soonest first.
 * Powers the Today View "Upcoming" strip — the roadmap of what's queued.
 *
 * @param focuses All configured focuses, usually `WeightRoomData.monthly_focus`.
 * @param dayKey `YYYY-MM-DD` key for the viewed day. An empty string
 *   yields an empty list (defensive against an unparseable clock).
 */
export function upcomingFocuses(
  focuses: readonly MonthlyFocus[],
  dayKey: string,
): MonthlyFocus[] {
  if (dayKey === '') return []
  return focuses
    .filter((focus) => focus.start_date > dayKey)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0))
}

/**
 * Add `n` days to a `YYYY-MM-DD` key, returning a new key. Local-noon
 * base time so DST transitions don't shift the calendar day. Same helper
 * shape as `strength-streaks.addDays`.
 */
function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toLocalDateKey(d)
}

/**
 * Inclusive day count between two `YYYY-MM-DD` keys (`end - start + 1`),
 * or `0` when `end` precedes `start`. Walks the calendar via
 * {@link addDays} so month boundaries and DST are handled correctly.
 */
function inclusiveDaySpan(startKey: string, endKey: string): number {
  if (endKey < startKey) return 0
  let count = 1
  let cursor = startKey
  while (cursor < endKey) {
    cursor = addDays(cursor, 1)
    count++
  }
  return count
}

/**
 * Per-day target attainment for one focus, restricted to its window up
 * to "today". A day counts as hit when the day's logged volume reaches
 * {@link MonthlyFocus.daily_target} — interpreted as total reps for
 * `target_kind: 'reps'` or distinct logged sets for `'sets'`.
 */
export interface FocusAdherence {
  /** Total calendar days in the focus window `[start_date, end_date]`. */
  daysInWindow: number
  /**
   * Days from `start_date` through the earlier of today and `end_date`,
   * inclusive. `0` before the window starts; equals `daysInWindow` once
   * the window has fully elapsed. The denominator for {@link percent}.
   */
  daysElapsed: number
  /** Count of elapsed days whose volume met the daily target. */
  daysHit: number
  /**
   * Consecutive hit days ending on the most recent elapsed day (today,
   * or `end_date` if the window is over). `0` if the latest elapsed day
   * was missed.
   */
  currentStreak: number
  /** `daysHit / daysElapsed`, or `0` when no day has elapsed yet. */
  percent: number
}

/**
 * Compute windowed adherence for a focus from the full set log.
 *
 * @param focus The focus to score.
 * @param sets All logged sets, usually `WeightRoomData.sets`; filtered to
 *   this focus's `exercise` and window internally.
 * @param now Clock for "today" (local). Defaults to `new Date()`; pass
 *   the viewer's clock from server-rendered surfaces so UTC doesn't
 *   disagree with their timezone (#197).
 */
export function computeFocusAdherence(
  focus: MonthlyFocus,
  sets: readonly StrengthSet[],
  now: Date = new Date(),
): FocusAdherence {
  const daysInWindow = inclusiveDaySpan(focus.start_date, focus.end_date)
  const today = toLocalDateKey(now)

  // Last elapsed day = min(today, end_date); nothing elapsed if today is
  // before the window opens.
  const lastElapsed =
    today === '' || today < focus.start_date
      ? ''
      : today < focus.end_date
        ? today
        : focus.end_date

  if (lastElapsed === '') {
    return { daysInWindow, daysElapsed: 0, daysHit: 0, currentStreak: 0, percent: 0 }
  }

  const daysElapsed = inclusiveDaySpan(focus.start_date, lastElapsed)

  // Bucket this focus's in-window volume by day.
  const volumeByDay = new Map<string, number>()
  for (const s of sets) {
    if (s.exercise !== focus.exercise) continue
    const day = toLocalDateKey(s.logged_at)
    if (day === '' || day < focus.start_date || day > lastElapsed) continue
    const increment = focus.target_kind === 'sets' ? 1 : s.reps
    volumeByDay.set(day, (volumeByDay.get(day) ?? 0) + increment)
  }

  const hit = (day: string): boolean => (volumeByDay.get(day) ?? 0) >= focus.daily_target

  let daysHit = 0
  for (const total of volumeByDay.values()) {
    if (total >= focus.daily_target) daysHit++
  }

  // Current streak walks backward from the last elapsed day.
  let currentStreak = 0
  let cursor = lastElapsed
  while (cursor >= focus.start_date && hit(cursor)) {
    currentStreak++
    cursor = addDays(cursor, -1)
  }

  return {
    daysInWindow,
    daysElapsed,
    daysHit,
    currentStreak,
    percent: daysElapsed === 0 ? 0 : daysHit / daysElapsed,
  }
}

/**
 * Load summary for a weighted focus, across all of its in-window sets.
 * All `null`/`0` when the focus is bodyweight (no set carries a
 * `weight_lbs`).
 */
export interface FocusLoadStats {
  /** Heaviest single set's load in lbs, or `null` if no weighted sets. */
  topSetLbs: number | null
  /**
   * Mean load across weighted sets in lbs (unrounded), or `null` if
   * none. Only sets that carry a `weight_lbs` count toward the average —
   * an unweighted warmup set doesn't drag it down.
   */
  avgLoadLbs: number | null
  /** Total tonnage = Σ `reps × weight_lbs` over weighted sets, in lbs. */
  tonnageLbs: number
  /** Number of in-window sets that carried a load. */
  weightedSets: number
}

/**
 * Compute load stats for a focus from the full set log, restricted to
 * the focus's `exercise` and `[start_date, end_date]` window.
 *
 * @param focus The focus to summarize.
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 */
export function computeFocusLoadStats(
  focus: MonthlyFocus,
  sets: readonly StrengthSet[],
): FocusLoadStats {
  let topSetLbs: number | null = null
  let loadSum = 0
  let tonnageLbs = 0
  let weightedSets = 0

  for (const s of sets) {
    if (s.exercise !== focus.exercise) continue
    const day = toLocalDateKey(s.logged_at)
    if (day === '' || day < focus.start_date || day > focus.end_date) continue
    if (s.weight_lbs == null) continue
    weightedSets++
    loadSum += s.weight_lbs
    tonnageLbs += s.reps * s.weight_lbs
    if (topSetLbs === null || s.weight_lbs > topSetLbs) topSetLbs = s.weight_lbs
  }

  return {
    topSetLbs,
    avgLoadLbs: weightedSets === 0 ? null : loadSum / weightedSets,
    tonnageLbs,
    weightedSets,
  }
}
