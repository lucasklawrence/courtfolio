'use client'

import { ZoneAboutSafari } from './ZoneAboutSafari'
import { ZoneAboutModern } from './ZoneAboutModern'
import { useIsSafari } from '@/utils/useIsSafari'

export function ZoneAbout() {
  return useIsSafari() ? <ZoneAboutSafari /> : <ZoneAboutModern />
}
