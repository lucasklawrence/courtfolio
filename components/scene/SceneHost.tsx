'use client'

import React, { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { cameraPresets } from '@/constants/cameraPresets'
import { BannersScene, CourtScene, FrontOfficeScene, LockerRoomScene, ProjectsScene } from '@/components/scenes'
import { ArenaShell, SceneRenderer, SceneRouteSync } from './index'
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
      'film-room': (
        <div className="w-full h-full flex items-center justify-center text-white bg-black">
          Film Room coming soon
        </div>
      ),
      rafters: (
        <div className="w-full h-full flex items-center justify-center text-white bg-black">
          Rafters coming soon
        </div>
      ),
    }),
    []
  )

  return (
    <ArenaShell initialScene={initialScene}>
      <SceneRouteSync />
      <SceneRenderer scenes={scenes} presets={cameraPresets} />
    </ArenaShell>
  )
}
