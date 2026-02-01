// TARGET PATH: src/motion/scale.ts
import type { MotionPreference } from '../prefs/preferences.types'

export function getMotionScale(pref: MotionPreference, prefersReducedMotion: boolean) {
  if (pref === 'off') return 0
  if (pref === 'quick') return 0.6
  if (pref === 'cinematic') return 1
  return prefersReducedMotion ? 0 : 1
}
