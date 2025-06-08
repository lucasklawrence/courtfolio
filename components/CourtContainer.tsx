'use client'

import React from 'react'

/**
 * CourtContainer ensures the basketball court scales responsively
 * to fill the screen height with consistent padding and positioning.
 *
 * @param children - React elements to render inside the court space
 */
export const CourtContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] overflow-hidden">
      {children}
    </div>
  )
}
