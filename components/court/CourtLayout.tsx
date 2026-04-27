'use client'

import { ReactNode } from 'react'
import { CourtSvg } from './CourtSvg'

/**
 * CourtLayout is the wrapper used by court-themed routes that need a
 * faded full-bleed CourtSvg background plus a centered foreground
 * content well. Renders a `<div>` (not `<main>`) so it nests cleanly
 * inside the root layout's `<main id="main">` landmark.
 *
 * @param children - The page content rendered above the decorative court SVG.
 */
export const CourtLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-white text-black px-6 py-20 relative overflow-hidden">
      {/* Decorative SVG background court */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" aria-hidden="true">
        <CourtSvg className="w-full h-full" />
      </div>

      {/* Foreground content — wrapped by the root layout's <main id="main"> landmark. */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}
