'use client'

import { useIsMobile } from '@/utils/hooks/useIsMobile'
import React, { useEffect, useState } from 'react'

/**
 * CourtContainer ensures the basketball court scales responsively,
 * centered and constrained to fit the viewport height with full width.
 * Provides scroll path for iOS Safari to enable pinch-to-zoom.
 * In landscape mobile, uses full viewport to avoid tight layout.
 */
export const CourtContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        ? 'w-[min(100vw,calc(100svh*1.5))] h-[min(100svh,calc(100vw/1.5))]'
        : 'w-[min(100vw,calc(100vh*1.5))] h-[min(100vh,calc(100vw/1.5))]'

  return (
    <div className="min-h-screen overflow-auto bg-neutral-900 touch-pan-x touch-pan-y">
      <div className="flex items-center justify-center min-h-screen">
        <div className={`relative ${sizeClass}`}>{children}</div>
      </div>
    </div>
  )
}
