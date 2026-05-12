'use client'

import { useIsMobile } from '@/utils/hooks/useIsMobile'
import React, { useEffect, useState } from 'react'

/**
 * FilmRoomContainer scales and centers the film room layout responsively,
 * preventing vertical scroll on desktop while allowing pinch zoom on mobile.
 */
export const FilmRoomContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMobile = useIsMobile()
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    const updateOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight)
    }

    updateOrientation()
    window.addEventListener('resize', updateOrientation)
    window.addEventListener('orientationchange', updateOrientation)

    return () => {
      window.removeEventListener('resize', updateOrientation)
      window.removeEventListener('orientationchange', updateOrientation)
    }
  }, [])

  const sizeClass =
    isMobile && isLandscape
      ? 'w-screen h-screen'
      : isMobile
        ? 'w-[min(100vw,calc(100svh*1.78))] h-[min(100svh,calc(100vw/1.78))]' // 16:9
        : 'w-[min(100vw,calc(100vh*1.78))] h-[min(100vh,calc(100vw/1.78))]'

  return (
    <div className="min-h-screen bg-black overflow-hidden touch-pan-x touch-pan-y">
      <div className="flex items-center justify-center min-h-screen">
        <div className={`relative ${sizeClass}`}>{children}</div>
      </div>
    </div>
  )
}
