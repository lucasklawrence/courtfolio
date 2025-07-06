'use client'

import React, { useEffect, useState } from 'react'
import { useIsMobile } from '@/utils/hooks/useIsMobile'

/**
 * CourtContainer
 *
 * Wraps the main court layout and ensures it maintains a responsive 2:3 aspect ratio.
 * Handles screen orientation and sizing logic for mobile/desktop, including landscape support.
 */
export const CourtContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMobile = useIsMobile()
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: landscape)')
    const updateOrientation = () => setIsLandscape(mediaQuery.matches)
    updateOrientation()
    mediaQuery.addEventListener('change', updateOrientation)
    return () => mediaQuery.removeEventListener('change', updateOrientation)
  }, [])

  const sizeClass = getCourtSizeClass(isMobile, isLandscape)

  return (
    <div className="min-h-screen overflow-y-scroll bg-neutral-900 touch-pan-x touch-pan-y">
      <div className="flex items-center justify-center min-h-[105vh]">
        <div className={`relative ${sizeClass}`}>{children}</div>
      </div>
    </div>
  )
}

/**
 * Computes the width/height Tailwind class string based on screen state.
 *
 * Maintains a 2:3 (w:h) ratio with a min() lock to prevent overflow.
 */
function getCourtSizeClass(isMobile: boolean, isLandscape: boolean): string {
  if (isMobile && isLandscape) return 'w-screen h-screen'

  const width = 'min(100vw,calc(100vh*1.5))'
  const height = 'min(100vh,calc(100vw/1.5))'

  return `w-[${width}] h-[${height}]`
}
