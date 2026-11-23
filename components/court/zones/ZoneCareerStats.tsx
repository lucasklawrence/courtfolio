'use client'

import { ZoneCareerStatsSafari } from './ZoneCareerStatsSafari'
import { ZoneCareerStatsModern } from './ZoneCareerStatsModern'
import { useIsSafari } from '@/utils/useIsSafari'

/**
 * Renders the Career Stats card using a Safari-compatible or modern component,
 * depending on the user's browser.
 */
export function ZoneCareerStats() {
  return useIsSafari() ? <ZoneCareerStatsSafari /> : <ZoneCareerStatsModern />
}
