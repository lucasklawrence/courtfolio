'use client'

import React, { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { cameraPresets } from '@/constants/cameraPresets'
import {
  BannersScene,
  CourtScene,
  FilmRoomScene,
  FrontOfficeScene,
  LockerRoomScene,
  ProjectsScene,
  RaftersScene,
} from '@/components/scenes'
import { ArenaShell, SceneExperienceProvider, SceneRenderer, SceneRouteSync } from './index'
import type { SceneId } from './SceneTypes'

/**
 * Hosts the arena shell, routing sync, and scene renderer in one place.
 */
export function SceneHost() {
  const pathname = usePathname()

  const pathToScene = (path: string): SceneId => {
    const clean = path.split('?')[0].replace(/\/$/, '') || '/'
    switch (clean) {
      case '/':
        return 'court'
      case '/locker-room':
        return 'locker-room'
      case '/about':
      case '/contact':
      case '/front-office':
        return 'front-office'
      case '/projects':
        return 'projects'
      case '/banners':
        return 'banners'
      case '/film-room':
        return 'film-room'
      case '/rafters':
        return 'rafters'
      default:
        return 'court'
    }
  }

  const initialScene = useMemo(() => pathToScene(pathname), [pathname])

  const scenes = useMemo(
    () => ({
      court: <CourtScene />,
      'locker-room': <LockerRoomScene />,
      'front-office': <FrontOfficeScene />,
      projects: <ProjectsScene />,
      banners: <BannersScene />,
      'film-room': <FilmRoomScene />,
      rafters: <RaftersScene />,
    }),
    []
  )

  return (
    <ArenaShell initialScene={initialScene}>
      <SceneExperienceProvider>
        <div className="relative min-h-screen w-screen bg-neutral-900 overflow-hidden">
          <SceneRouteSync />
          <SceneRenderer scenes={scenes} presets={cameraPresets} />
        </div>
      </SceneExperienceProvider>
    </ArenaShell>
  )
}
