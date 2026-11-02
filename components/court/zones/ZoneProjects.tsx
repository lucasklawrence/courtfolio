'use client'

import { ZoneProjectsSafari } from './ZoneProjectsSafari'
import { ZoneProjectsModern } from './ZoneProjectsModern'
import { useIsSafari } from '@/utils/useIsSafari'

export function ZoneProjects() {
  return useIsSafari() ? <ZoneProjectsSafari /> : <ZoneProjectsModern />
}
