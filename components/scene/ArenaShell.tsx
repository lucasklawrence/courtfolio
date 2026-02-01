'use client'

import React from 'react'
import { SceneProvider } from './SceneProvider'
import type { SceneId } from './SceneTypes'

/**
 * Persistent wrapper that keeps shared arena state alive across scene swaps.
 * Future work: mount camera wrapper, ambience, and overlays here.
 */
export function ArenaShell({
  children,
  initialScene,
}: {
  children: React.ReactNode
  initialScene?: SceneId
}) {
  return <SceneProvider initialScene={initialScene}>{children}</SceneProvider>
}
