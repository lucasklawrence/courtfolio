'use client'

import { useIsSafari } from '@/utils/useIsSafari'
import { ZoneContactSafari } from './ZoneContactSafari'
import { ZoneContactModern } from './ZoneContactModern'

export function ZoneContact() {
  return useIsSafari() ? <ZoneContactSafari /> : <ZoneContactModern />
}
