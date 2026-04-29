/**
 * Track / walking detail-view helpers (PRD §7.4).
 *
 * Walking shares chart projections with running — pace trend, cardiac
 * efficiency, and pace-at-HR are all activity-agnostic computations over a
 * pre-filtered session list. So the only walking-specific helper is the
 * activity filter; the projections live in {@link ../running} and are imported
 * by both detail views.
 */

import type { CardioSession } from '@/types/cardio'
import type { DateRange } from '@/components/training-facility/shared/DateFilter'
import { filterCardioSessionsByActivity } from './cardio-shared'

/**
 * Filter `sessions` down to walking entries inside `range`. Thin wrapper over
 * {@link filterCardioSessionsByActivity} so the `TrackDetailView` call site
 * reads as the equipment-specific verb.
 *
 * @param sessions - Full session list from `getCardioData()`.
 * @param range - Active range from the shared `DateFilter`.
 */
export function filterWalkingSessions(
  sessions: readonly CardioSession[],
  range: DateRange,
): CardioSession[] {
  return filterCardioSessionsByActivity(sessions, 'walking', range)
}
