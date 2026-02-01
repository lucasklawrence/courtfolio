'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useScene } from './SceneProvider'
import type { SceneId } from './SceneTypes'

const pathToScene = (pathname: string): SceneId => {
  const clean = pathname.split('?')[0].replace(/\/$/, '') || '/'
  switch (clean) {
    case '/':
      return 'court'
    case '/locker-room':
      return 'locker-room'
    case '/front-office':
    case '/about':
    case '/contact':
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

const sceneToPath = (scene: SceneId): string => {
  switch (scene) {
    case 'court':
      return '/'
    case 'locker-room':
      return '/locker-room'
    case 'front-office':
      return '/contact'
    case 'projects':
      return '/projects'
    case 'banners':
      return '/banners'
    case 'film-room':
      return '/film-room'
    case 'rafters':
      return '/rafters'
    default:
      return '/'
  }
}

/**
 * Bidirectional sync between the URL path and scene state.
 */
export function SceneRouteSync() {
  const router = useRouter()
  const pathname = usePathname()
  const { currentScene, goToScene } = useScene()
  const hydratingFromPath = useRef(false)

  // Path -> scene
  useEffect(() => {
    const targetScene = pathToScene(pathname)
    if (targetScene !== currentScene) {
      hydratingFromPath.current = true
      goToScene(targetScene, { force: true })
    }
  }, [pathname, currentScene, goToScene])

  // Scene -> path
  useEffect(() => {
    const nextPath = sceneToPath(currentScene)

    if (hydratingFromPath.current) {
      hydratingFromPath.current = false
      return
    }

    if (pathname !== nextPath) {
      router.push(nextPath)
    }
  }, [currentScene, pathname, router])

  return null
}
