'use client'

import { isSafari } from '@/utils/isSafari'
import { ZoneFantasySafari } from './ZoneFantasySafari'
import { ZoneFantasyModern } from '../ZoneFantasyModern'

/**
 * Wrapper that selects the correct Fantasy Football AI zone component
 * based on whether the user is on Safari or a modern browser.
 */
export function ZoneFantasy() {
  return isSafari() ? <ZoneFantasySafari /> : <ZoneFantasyModern />
}
