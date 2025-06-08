'use client'

import { SafeSvgHtml } from './SafeSvgHtml'

/**
 * Modern version of Bars of the Day project zone.
 * Uses backdrop blur and full Tailwind styling inside SVG foreignObject.
 */
export function ZoneBarsModern() {
  return (
    <SafeSvgHtml>
      <a
        href="https://barsoftheday.com"
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-orange-900/70 backdrop-blur-sm text-white p-4 rounded-xl border border-orange-500/30 shadow-md hover:bg-orange-800/80 hover:scale-105 transition"
      >
        <h3 className="text-lg font-bold text-orange-300 text-center">🎤 Bars of the Day</h3>
        <p className="text-xs text-center mt-1 leading-snug text-white/90">
          A daily drop of lyrical greatness — curated hip-hop bars with clean typography and smooth
          flow.
        </p>
        <p className="text-xs text-center italic text-orange-400 pt-1">
          Supabase • Next.js • Tailwind
        </p>
      </a>
    </SafeSvgHtml>
  )
}
