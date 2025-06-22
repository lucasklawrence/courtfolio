import { ZoneAboutSafari } from '../ZoneAboutSafari'
import { ZoneAboutModern } from '../ZoneAboutModern'
import { isSafari } from '@/utils/isSafari'

export function ZoneAbout() {
  return isSafari() ? <ZoneAboutSafari /> : <ZoneAboutModern />
}
