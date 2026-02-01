import type { UserPrefs } from './preferences.types'

export const PREFS_STORAGE_KEY = 'arena:prefs'

export const DEFAULT_PREFS: UserPrefs = {
  motion: 'cinematic',
  tutorial: true,
}
