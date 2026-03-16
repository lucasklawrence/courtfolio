'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { CameraPreset, SceneContextValue, SceneId, TransitionState } from './SceneTypes'
import { trackSceneNavigation } from '@/utils/analytics'

const SceneContext = createContext<SceneContextValue | undefined>(undefined)

const DEFAULT_SCENE: SceneId = 'court'

/**
 * Central scene state holder. Keeps the arena shell mounted while swapping scenes
 * and exposes a single navigation API.
 */
export function SceneProvider({
  children,
  initialScene = DEFAULT_SCENE,
}: {
  children: React.ReactNode
  initialScene?: SceneId
}) {
  const [currentScene, setCurrentScene] = useState<SceneId>(initialScene)
  const [previousScene, setPreviousScene] = useState<SceneId | null>(null)
  const [transitionState, setTransitionState] = useState<TransitionState>('idle')

  const goToScene = useCallback(
    (sceneId: SceneId, options?: { force?: boolean }) => {
      if (!options?.force && sceneId === currentScene) return

      setPreviousScene(currentScene)
      setCurrentScene(sceneId)
      setTransitionState('transitioning')

      trackSceneNavigation({ from: currentScene, to: sceneId, reason: options?.force ? 'route-sync' : 'user' })
    },
    [currentScene]
  )

  const finishTransition = useCallback(() => {
    setTransitionState('idle')
  }, [])

  const value: SceneContextValue = useMemo(
    () => ({
      currentScene,
      previousScene,
      transitionState,
      goToScene,
      finishTransition,
    }),
    [currentScene, previousScene, transitionState, goToScene, finishTransition]
  )

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
}

export function useScene() {
  const context = useContext(SceneContext)
  if (!context) {
    throw new Error('useScene must be used within a SceneProvider')
  }
  return context
}

export type CameraPresetMap = Record<SceneId, CameraPreset>
