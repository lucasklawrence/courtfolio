// TARGET PATH: src/prefs/PreferencesProvider.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { MotionPreference, UserPrefs } from './preferences.types'
import { DEFAULT_PREFS, PREFS_STORAGE_KEY } from './preferences.store'

type PrefsContextValue = {
  prefs: UserPrefs
  updatePrefs: (next: Partial<UserPrefs>) => void
}

const PrefsContext = createContext<PrefsContextValue | null>(null)

const isMotionPreference = (value: unknown): value is MotionPreference =>
  value === 'cinematic' || value === 'quick' || value === 'off' || value === 'system'

const normalizePrefs = (value: unknown): UserPrefs => {
  if (!value || typeof value !== 'object') return DEFAULT_PREFS

  const candidate = value as Partial<UserPrefs>
  return {
    motion: isMotionPreference(candidate.motion) ? candidate.motion : DEFAULT_PREFS.motion,
    tutorial: typeof candidate.tutorial === 'boolean' ? candidate.tutorial : DEFAULT_PREFS.tutorial,
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY)
      if (!raw) return
      setPrefs(normalizePrefs(JSON.parse(raw)))
    } catch {
      setPrefs(DEFAULT_PREFS)
    }
  }, [])

  const updatePrefs = (next: Partial<UserPrefs>) => {
    setPrefs(prev => {
      const merged = { ...prev, ...next }
      try {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(merged))
      } catch {
        // Ignore storage errors (private mode, quota, etc.).
      }
      return merged
    })
  }

  return <PrefsContext.Provider value={{ prefs, updatePrefs }}>{children}</PrefsContext.Provider>
}

export function useUserPrefs() {
  const context = useContext(PrefsContext)
  if (!context) {
    throw new Error('useUserPrefs must be used within PreferencesProvider')
  }
  return context
}
