'use client'

import { isSafari } from '@/utils/isSafari'
import { ZoneBarsSafari } from './ZoneBarsSafari'
import { ZoneBarsModern } from './ZoneBarsModern'

/**
 * Browser-agnostic wrapper that renders the appropriate
 * Bars of the Day zone content based on Safari detection.
 */
export function ZoneBars() {
  return isSafari() ? <ZoneBarsSafari /> : <ZoneBarsModern />
}
