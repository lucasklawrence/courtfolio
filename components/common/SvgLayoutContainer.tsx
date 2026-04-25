import React from 'react'
import { MobileSwipeHint } from './MobileSwipeHint'

/**
 * SvgLayoutContainer
 *
 * Responsive wrapper for the basketball court layout. Maintains a 1.5:1
 * aspect ratio and scales to the visible viewport. The sizing is pure CSS
 * (no client-only hooks) so SSR and client render identical markup — which
 * matters on iOS Safari where `100vh` ≠ `100svh` due to the dynamic URL bar.
 *
 * - Any device: width/height follow a 1.5:1 ratio inside the small viewport.
 * - Touch + landscape (phone held sideways): go full viewport to avoid
 *   letterboxing.
 * - Touch + portrait: fill viewport height and let the scene overflow
 *   horizontally so it stays full-size and readable. A one-time swipe hint
 *   nudges users toward the horizontal gesture.
 */
export const SvgLayoutContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative min-h-svh overflow-y-scroll bg-neutral-900 touch-pan-x touch-pan-y touch-pinch-zoom max-md:portrait:h-svh max-md:portrait:min-h-0 max-md:portrait:overflow-x-auto max-md:portrait:overflow-y-hidden">
      <div className="flex items-center justify-center min-h-[105svh] max-md:portrait:min-h-svh max-md:portrait:items-stretch max-md:portrait:justify-start">
        <div className="relative w-[min(100vw,calc(100svh*1.5))] h-[min(100svh,calc(100vw/1.5))] pointer-coarse:landscape:w-screen pointer-coarse:landscape:h-[100svh] max-md:portrait:w-[calc(100svh*1.5)] max-md:portrait:h-svh max-md:portrait:shrink-0">
          {children}
        </div>
      </div>
      <MobileSwipeHint />
    </div>
  )
}
