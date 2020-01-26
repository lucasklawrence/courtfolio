'use client'

import { ReactNode } from 'react'
import { CourtSvg } from './CourtSvg'

export const CourtLayout = ({ children }: { children: ReactNode }) => {
  return (
    <main className="min-h-screen bg-white text-black px-6 py-20 relative overflow-hidden">
      {/* Decorative SVG background court */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" aria-hidden="true">
        <CourtSvg className="w-full h-full" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10">{children}</div>
    </main>
  )
}
