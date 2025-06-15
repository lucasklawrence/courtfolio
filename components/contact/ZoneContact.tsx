'use client'

import { isSafari } from '@/utils/isSafari'
import { ZoneContactSafari } from './ZoneContactSafari'
import { ZoneContactModern } from './ZoneContactModern'

export function ZoneContact() {
  return isSafari() ? <ZoneContactSafari /> : <ZoneContactModern />
}
