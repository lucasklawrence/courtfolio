import React from 'react'

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
 */
export const SvgLayoutContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen overflow-y-scroll bg-neutral-900 touch-pan-x touch-pan-y touch-pinch-zoom">
      <div className="flex items-center justify-center min-h-[105vh]">
        <div className="relative w-[min(100vw,calc(100svh*1.5))] h-[min(100svh,calc(100vw/1.5))] pointer-coarse:landscape:w-screen pointer-coarse:landscape:h-screen">
          {children}
        </div>
      </div>
    </div>
  )
}
