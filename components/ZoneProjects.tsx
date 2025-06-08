import { ZoneProjectsSafari } from './ZoneProjectsSafari'
import { ZoneProjectsModern } from './ZoneProjectsModern'
import { isSafari } from '@/utils/isSafari'

export function ZoneProjects() {
  return isSafari() ? <ZoneProjectsSafari /> : <ZoneProjectsModern />
}
