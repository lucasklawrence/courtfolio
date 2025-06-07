'use client'

import { CourtSvg } from '@/components/CourtSvg'
import { CourtTitle } from '@/components/CourtTitle'
import { BackToCourtButton } from '@/components/BackToCourtButton'
import React from 'react'

export default function ContactPage() {
  return (
    <React.Fragment>
      {/* 🏀 Court Background */}
      <CourtSvg
        zoneContent={{    
            'zone-90': (
  <foreignObject x="280" y="200" width="360" height="140">
    <a
      href="https://barsoftheday.com"
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-orange-900/70 backdrop-blur-sm text-white p-4 rounded-xl border border-orange-500/30 shadow-md hover:bg-orange-800/80 hover:scale-105 transition"
    >
      <h3 className="text-lg font-bold text-orange-300 text-center">🎤 Bars of the Day</h3>
      <p className="text-xs text-center mt-1 leading-snug text-white/90">
        A daily drop of lyrical greatness — curated hip-hop bars with clean typography and smooth flow.
      </p>
      <p className="text-xs text-center mt-1 italic text-orange-400">
        Built with Supabase, Next.js, Tailwind, and care.
      </p>
    </a>
  </foreignObject>
),
'zone-91': (
  <foreignObject x="880" y="200" width="360" height="140">
    <div className="bg-orange-950/70 backdrop-blur-sm text-white p-4 rounded-xl border border-orange-500/30 shadow-md space-y-1">
      <h3 className="text-lg font-bold text-orange-300 text-center">🏈 Fantasy Football AI</h3>
      <p className="text-xs text-center leading-snug text-white/90">
        Draft strategy. Weekly matchups. Trade logic. <br />
        A fantasy football assistant powered by data & ML.
      </p>
      <p className="text-xs text-center italic text-orange-400 pt-1">
        Coming August 2025 — stay tuned.
      </p>
    </div>
  </foreignObject>
),
            'zone-99': (
                        <foreignObject x="1150" y="850" width="300" height="70">
                          <div xmlns="http://www.w3.org/1999/xhtml" className="flex items-center justify-center w-full h-full">
                            <BackToCourtButton />
                          </div>
                        </foreignObject>
                      )      
        }}
      />
      <CourtTitle
        title="Lucas Lawrence"
        subtitle="Highlight Reel"
        />
    </React.Fragment>
  )
}
