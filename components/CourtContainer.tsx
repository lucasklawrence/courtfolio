'use client'

import React from 'react'

/**
 * CourtContainer ensures the basketball court scales responsively,
 * centered and constrained to fit the viewport height with full width.
 */
export const CourtContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="fixed inset-0 bg-neutral-900 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full max-w-[100vw] max-h-[100dvh]">
        {children}
      </div>
    </div>
  )
}