import type { CardioSession } from '@/types/cardio'

import { parseSessionDate } from './cardio-shared'

/**
 * Result of {@link computeStreaks}: the all-time current and longest
 * streaks of consecutive calendar days with at least one cardio session.
 */
export interface StreakResult {
  /**
   * Length in days of the streak that includes today (or yesterday, if
   * today's session hasn't been logged yet). `0` when the most recent
   * session is older than yesterday.
   */
  current: number
  /**
   * Length in days of the longest run of consecutive calendar days with at
   * least one session, ever — independent of {@link current}.
   */
  longest: number
}

/** Get a `YYYY-MM-DD` local-date key from a Date. */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Add `n` days to a `YYYY-MM-DD` key, returning a new key. Uses local-noon
 * as the base time so DST transitions don't accidentally shift the date.
 */
function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/**
 * Count consecutive calendar days (in local time) with at least one cardio
 * session. Multiple sessions on the same day count as one day. The "current"
 * streak counts backwards from today (or yesterday if today has no session
 * logged yet) and is `0` if the last logged day is older than yesterday.
 *
 * Intended for the all-cardio overview's `StreakCounter`: pass `data.sessions`
 * for the all-time numbers, and pass the date-filtered sessions to compute a
 * "longest streak in this range" variant.
 *
 * @param sessions cardio sessions to score; activity does not matter — any
 *   logged session counts as a workout day.
 */
export function computeStreaks(sessions: readonly CardioSession[]): StreakResult {
  if (sessions.length === 0) return { current: 0, longest: 0 }

  const days = new Set<string>()
  for (const s of sessions) {
    const d = parseSessionDate(s.date)
    if (!Number.isFinite(d.getTime())) continue
    days.add(toDateKey(d))
  }
  if (days.size === 0) return { current: 0, longest: 0 }

  const sorted = Array.from(days).sort()

  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (addDays(sorted[i - 1], 1) === sorted[i]) {
      run++
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  const today = toDateKey(new Date())
  const yesterday = addDays(today, -1)
  const lastDay = sorted[sorted.length - 1]

  if (lastDay !== today && lastDay !== yesterday) {
    return { current: 0, longest }
  }

  let current = 1
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (addDays(sorted[i], 1) === sorted[i + 1]) {
      current++
    } else {
      break
    }
  }

  return { current, longest: Math.max(longest, current) }
}
