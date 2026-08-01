import type { WeightRoomWorkout } from '@/types/weight-room'

import { pacificDayKey } from './day-keys'

/**
 * Pure helpers for bounded workout sessions (#374).
 *
 * Everything here is date/duration arithmetic with no Supabase involvement, so
 * the admin routes stay thin and the two rules worth getting right — which day
 * a session belongs to, and what happens to one you forgot to end — are
 * unit-testable in isolation.
 */

/**
 * How long an in-progress workout may sit before the next `start` treats it as
 * abandoned rather than as a session you're still in the middle of.
 *
 * Twelve hours comfortably clears any real session (the longest gym visit is a
 * couple of hours) while still catching "started Monday evening, forgot to hit
 * end, back Wednesday". Below that, an honest long session — a hike, a
 * two-a-day logged as one — could be closed out from under you.
 */
export const STALE_WORKOUT_HOURS = 12

/** Milliseconds in {@link STALE_WORKOUT_HOURS}. */
const STALE_WORKOUT_MS = STALE_WORKOUT_HOURS * 60 * 60 * 1000

/**
 * Which calendar day a workout belongs to, as a Pacific `YYYY-MM-DD` key.
 *
 * Derived from {@link WeightRoomWorkout.started_at}, never from `ended_at`: a
 * session that crosses midnight belongs wholly to the day it began, because
 * splitting one workout across two days would be wrong in every rollup that
 * consumes it.
 *
 * Pacific rather than the server's zone for the reason #319 unified on — Vercel
 * runs the server in UTC, so local-time bucketing would silently shift every
 * boundary between SSR and the browser.
 *
 * @param workout The session to place.
 * @returns The day key, or `null` when `started_at` isn't a parseable timestamp.
 */
export function workoutDayKey(workout: Pick<WeightRoomWorkout, 'started_at'>): string | null {
  const started = new Date(workout.started_at)
  if (!Number.isFinite(started.getTime())) return null
  return pacificDayKey(started)
}

/**
 * Whether an in-progress workout has been open long enough to count as
 * abandoned.
 *
 * @param startedAt ISO timestamp the session began.
 * @param now Evaluation instant; defaults to the current time.
 * @returns `false` when `startedAt` is unparseable — an unreadable timestamp is
 *   not evidence of staleness, and auto-ending on it would destroy a session on
 *   the strength of a bug.
 */
export function isStaleOpenWorkout(startedAt: string, now: Date = new Date()): boolean {
  const started = new Date(startedAt)
  if (!Number.isFinite(started.getTime())) return false
  return now.getTime() - started.getTime() > STALE_WORKOUT_MS
}

/**
 * The `ended_at` to stamp on a stale session being auto-closed.
 *
 * Uses the **last set logged into that session** — the last real evidence the
 * user was training — rather than "now", which would invent hours of session
 * that never happened, or the staleness horizon, which is an arbitrary clock
 * boundary. A session with no sets at all collapses to zero duration at
 * `started_at`, which is honest: nothing was recorded, so nothing happened.
 *
 * Never returns a value before `started_at`; a set stamped earlier than its own
 * session (backdating slop) would otherwise violate the table's
 * `ended_at >= started_at` check.
 *
 * @param startedAt ISO timestamp the session began.
 * @param lastSetLoggedAt ISO timestamp of the newest set in the session, or
 *   `null` when it has none.
 */
export function autoEndTimestamp(
  startedAt: string,
  lastSetLoggedAt: string | null,
): string {
  if (lastSetLoggedAt === null) return startedAt
  const started = new Date(startedAt)
  const lastSet = new Date(lastSetLoggedAt)
  if (!Number.isFinite(lastSet.getTime()) || !Number.isFinite(started.getTime())) {
    return startedAt
  }
  return lastSet.getTime() < started.getTime() ? startedAt : lastSetLoggedAt
}

/**
 * Whether `endedAt` lands strictly before `startedAt`, compared as **instants**.
 *
 * String comparison is wrong here even though both sides are ISO 8601: the
 * format only sorts lexicographically when every value shares one UTC offset,
 * and this codebase mixes them — `dayKeyToPacificNoonIso` emits `-07:00`/`-08:00`
 * offsets while `new Date().toISOString()` emits `Z`. `2026-08-01T05:00:00-07:00`
 * is two hours *after* `2026-08-01T10:00:00Z` and sorts before it.
 *
 * @param startedAt ISO timestamp the session began.
 * @param endedAt ISO timestamp the session ended.
 * @returns `true` when the end precedes the start, `false` when it doesn't, and
 *   `null` when either value isn't a parseable timestamp — which the caller
 *   should reject rather than forward to Postgres as a 500.
 */
export function endsBeforeStart(startedAt: string, endedAt: string): boolean | null {
  const started = new Date(startedAt).getTime()
  const ended = new Date(endedAt).getTime()
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return null
  return ended < started
}

/**
 * Elapsed minutes of a session, or `null` while it's still in progress.
 *
 * Rounded to the nearest minute — the consuming surfaces (#377) display whole
 * minutes, so rounding here keeps a displayed duration and any derived rate
 * computed from one value.
 *
 * @param workout The session to measure.
 */
export function workoutDurationMinutes(
  workout: Pick<WeightRoomWorkout, 'started_at' | 'ended_at'>,
): number | null {
  if (workout.ended_at === undefined) return null
  const started = new Date(workout.started_at)
  const ended = new Date(workout.ended_at)
  if (!Number.isFinite(started.getTime()) || !Number.isFinite(ended.getTime())) return null
  return Math.round((ended.getTime() - started.getTime()) / 60000)
}
