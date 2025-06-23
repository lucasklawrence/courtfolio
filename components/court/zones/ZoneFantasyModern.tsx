'use client'

import { SafeSvgHtml } from "@/components/common/SafeSvgHtml"


/**
 * Modern version of Fantasy Football AI project zone.
 * Uses Tailwind styling and backdrop blur inside SVG.
 */
export function ZoneFantasyModern() {
  return (
    <SafeSvgHtml>
      <div className="bg-orange-950/70 backdrop-blur-sm text-white p-4 rounded-xl border border-orange-500/30 shadow-md space-y-1">
        <h3 className="text-lg font-bold text-orange-300 text-center">🏈 Fantasy Football AI</h3>
        <p className="text-xs text-center leading-snug text-white/90">
          Draft strategy. Weekly matchups. Trade logic. <br />A fantasy football assistant powered
          by data & ML.
        </p>
        <p className="text-xs text-center italic text-orange-400 pt-1">
          Coming August 2025 — stay tuned.
        </p>
      </div>
    </SafeSvgHtml>
  )
}
