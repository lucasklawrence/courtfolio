/**
 * Stair-climber detail-view helpers (PRD §7.4).
 *
 * Stair-specific filter sits here; activity-agnostic helpers
 * (`parseSessionDate`, HR-zone aggregation, avg-HR projection, duration
 * formatter, related types) live in {@link ./cardio-shared} and are re-exported
 * for backwards compatibility with the existing `StairDetailView` import path.
 */

import type { CardioSession } from '@/types/cardio'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'
import { filterCardioSessionsByActivity } from './cardio-shared'

export {
  parseSessionDate,
  aggregateHrZoneSeconds,
  perSessionAvgHr,
  formatDuration,
} from './cardio-shared'
export type { HrZoneBucket, SessionAvgHrPoint } from './cardio-shared'

/**
 * Filter `sessions` down to stair-climbing entries inside `range`. Thin
 * wrapper over {@link filterCardioSessionsByActivity} so the call site at
 * `StairDetailView` reads as the equipment-specific verb.
 *
 * @param sessions - Full session list from `getCardioData()`.
 * @param range - Active range from the shared `DateFilter`.
 */
export function filterStairSessions(
  sessions: readonly CardioSession[],
  range: DateRange,
): CardioSession[] {
  return filterCardioSessionsByActivity(sessions, 'stair', range)
}
