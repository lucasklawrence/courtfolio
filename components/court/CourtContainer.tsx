'use client'

import React from 'react'

/**
 * CourtContainer ensures the basketball court scales responsively,
 * centered and constrained to fit the viewport height with full width.
 */
export const CourtContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="fixed inset-0 bg-neutral-900 overflow-hidden">
      <div className="w-full h-full [aspect-ratio:1536/1024] mx-auto">{children}</div>
    </div>
  )
}
