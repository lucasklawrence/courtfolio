'use client'

import { ZoneBioCardSafari } from './ZoneBioCardSafari'
import { ZoneBioCardModern } from './ZoneBioCardModern'
import { useIsSafari } from '@/utils/useIsSafari'

/**
 * Selects the appropriate Bio Card component depending on whether the user is using Safari.
 * Uses modern backdrop blur styling where supported.
 */
export function ZoneBioCard() {
  return useIsSafari() ? <ZoneBioCardSafari /> : <ZoneBioCardModern />
}
