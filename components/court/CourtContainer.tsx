'use client'

import React from 'react'

/**
 * CourtContainer ensures the basketball court scales responsively,
 * centered and constrained to fit the viewport height with full width.
 */
export const CourtContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="fixed inset-0 bg-neutral-900 flex items-center justify-center touch-pan-x touch-pan-y">
<div className="relative w-[min(100vw,calc(100svh*1.5))] h-[min(100svh,calc(100vw/1.5))]">
        {children}
      </div>
    </div>
  )
}
