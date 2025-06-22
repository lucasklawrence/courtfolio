'use client'

import { ReactNode } from 'react'
import { CourtSvg } from './court/CourtSvg'

type CourtLayoutProps = {
  children: ReactNode
}

export function CourtLayout({ children }: CourtLayoutProps) {
  return (
    <main className="min-h-screen bg-white text-black px-6 py-20 relative overflow-hidden">
      {/* SVG background court */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
        <CourtSvg className="w-full h-full" />
      </div>

      {/* Page content */}
      <div className="relative z-10">{children}</div>
    </main>
  )
}
