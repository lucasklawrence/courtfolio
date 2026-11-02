'use client'

import { useIsSafari } from '@/utils/useIsSafari'
import { ZoneBarsSafari } from './ZoneBarsSafari'
import { ZoneBarsModern } from './ZoneBarsModern'

/**
 * Browser-agnostic wrapper that renders the appropriate
 * Bars of the Day zone content based on Safari detection.
 */
export function ZoneBars() {
  return useIsSafari() ? <ZoneBarsSafari /> : <ZoneBarsModern />
}
