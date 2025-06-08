'use client'

import { ZoneBioCardSafari } from './ZoneBioCardSafari'
import { ZoneBioCardModern } from './ZoneBioCardModern'
import { isSafari } from '@/utils/isSafari'

/**
 * Selects the appropriate Bio Card component depending on whether the user is using Safari.
 * Uses modern backdrop blur styling where supported.
 */
export function ZoneBioCard() {
  return isSafari() ? <ZoneBioCardSafari /> : <ZoneBioCardModern />
}
