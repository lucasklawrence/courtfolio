'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import { useHasSeenIntro } from '@/utils/useHasSeenIntro'

type SceneExperienceValue = {
  showIntro: boolean
  markIntroSeen: () => void
  ambienceEnabled: boolean
  setAmbienceEnabled: (enabled: boolean) => void
}

const SceneExperienceContext = createContext<SceneExperienceValue | undefined>(undefined)

export function SceneExperienceProvider({ children }: { children: React.ReactNode }) {
  const { ready, showIntro: storedIntro, setHasSeenIntro } = useHasSeenIntro()
  const [ambienceEnabled, setAmbienceEnabled] = useState(true)

  const showIntro = ready ? storedIntro : false

  const value = useMemo<SceneExperienceValue>(
    () => ({
      showIntro,
      markIntroSeen: () => setHasSeenIntro(true),
      ambienceEnabled,
      setAmbienceEnabled,
    }),
    [showIntro, ambienceEnabled, setHasSeenIntro]
  )

  return <SceneExperienceContext.Provider value={value}>{children}</SceneExperienceContext.Provider>
}

export function useSceneExperience() {
  const ctx = useContext(SceneExperienceContext)
  if (!ctx) throw new Error('useSceneExperience must be used within SceneExperienceProvider')
  return ctx
}
