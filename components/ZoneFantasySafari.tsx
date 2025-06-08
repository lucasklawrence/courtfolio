'use client'

import { CourtZone } from '@/components/CourtZone'
import { SafeSvgHtml } from '@/components/SafeSvgHtml'

/**
 * Safari-compatible version of Fantasy Football AI zone.
 * Uses inline styles and static layout for broader compatibility.
 */
export function ZoneFantasySafari() {
  return (
      <SafeSvgHtml>
        <div
          style={{
            backgroundColor: 'rgba(20, 10, 5, 0.7)',
            backdropFilter: 'blur(4px)',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid rgba(255, 165, 0, 0.3)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            fontSize: '0.75rem',
            textAlign: 'center',
          }}
        >
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 'bold',
              color: '#FDBA74',
              margin: 0,
            }}
          >
            🏈 Fantasy Football AI
          </h3>
          <p
            style={{
              marginTop: '0.25rem',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: '1.25rem',
            }}
          >
            Draft strategy. Weekly matchups. Trade logic.
            <br />A fantasy football assistant powered by data & ML.
          </p>
          <p
            style={{
              marginTop: '0.5rem',
              fontStyle: 'italic',
              color: '#FDBA74',
            }}
          >
            Coming August 2025 — stay tuned.
          </p>
        </div>
      </SafeSvgHtml>
  )
}
