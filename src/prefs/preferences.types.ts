// TARGET PATH: src/prefs/preferences.types.ts
export type MotionPreference = 'cinematic' | 'quick' | 'off' | 'system'

export type UserPrefs = {
  motion: MotionPreference
  tutorial: boolean
}
