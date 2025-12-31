'use client'

import { useIsMobile } from '@/utils/hooks/useIsMobile'
import React, { useEffect, useState } from 'react'

/**
 * CourtContainer
 *
 * A responsive wrapper for the basketball court layout that maintains aspect ratio
 * and full-viewport presentation across devices, while enabling mobile gestures.
 *
 * ## Responsibilities:
 * - Maintains a centered court layout with constrained aspect ratio (1.5:1).
 * - Dynamically adjusts layout for mobile portrait vs. landscape orientations.
 * - Enables native pan and pinch-to-zoom gestures via `touch-action` styles.
 * - Provides a scrollable wrapper on iOS to avoid gesture blocking.
 *
 * ## Layout Behavior:
 * - Mobile portrait: Fits within `100svh` and scales width proportionally.
 * - Mobile landscape: Uses full screen (`w-screen h-screen`) to avoid letterboxing.
 * - Desktop: Scales based on `100vh` height to maintain aspect ratio.
 *
 * @param children - The child elements (court SVG and overlays) to render inside the container.
 * @returns A responsive layout wrapper with gesture support and adaptive scaling.
 */
export const SvgLayoutContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMobile = useIsMobile()
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth > window.innerHeight
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const orientationQuery = window.matchMedia('(orientation: landscape)')

    const updateOrientation = () => {
      const matchesMedia = orientationQuery?.matches
      const byDimensions = window.innerWidth > window.innerHeight
      setIsLandscape(matchesMedia ?? byDimensions)
    }

    updateOrientation()
    orientationQuery?.addEventListener
      ? orientationQuery.addEventListener('change', updateOrientation)
      : orientationQuery?.addListener(updateOrientation)
    window.addEventListener('resize', updateOrientation)

    return () => {
      orientationQuery?.removeEventListener
        ? orientationQuery.removeEventListener('change', updateOrientation)
        : orientationQuery?.removeListener(updateOrientation)
      window.removeEventListener('resize', updateOrientation)
    }
  }, [])

  const sizeClass =
    isMobile && isLandscape
      ? 'w-screen h-screen'
      : isMobile
        ? 'w-[min(100vw,calc(100svh*1.5))] h-[min(100svh,calc(100vw/1.5))]'
        : 'w-[min(100vw,calc(100vh*1.5))] h-[min(100vh,calc(100vw/1.5))]'

  return (
    <div className="min-h-screen overflow-y-scroll bg-neutral-900 touch-pan-x touch-pan-y touch-pinch-zoom">
      <div className="flex items-center justify-center min-h-[105vh]">
        <div className={`relative ${sizeClass}`}>{children}</div>
      </div>
    </div>
  )
}
