'use client'

import { CourtZone } from '@/components/CourtZone'
import { SafeSvgHtml } from '@/components/SafeSvgHtml'

/**
 * Safari-compatible version of Bars of the Day project zone.
 * Uses inline styles inside SafeSvgHtml to avoid <foreignObject> rendering issues.
 */
export function ZoneBarsSafari() {
  return (
    <CourtZone x={280} y={200} width={360} height={140}>
      <SafeSvgHtml>
        <a
          href="https://barsoftheday.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            backgroundColor: 'rgba(38, 20, 4, 0.7)',
            backdropFilter: 'blur(4px)',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid rgba(255, 165, 0, 0.3)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            textDecoration: 'none',
            transition: 'transform 0.2s ease-in-out',
          }}
          onMouseOver={e => {
            ;(e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.05)'
          }}
          onMouseOut={e => {
            ;(e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'
          }}
        >
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 'bold',
              color: '#FDBA74',
              textAlign: 'center',
              margin: 0,
            }}
          >
            🎤 Bars of the Day
          </h3>
          <p
            style={{
              fontSize: '0.75rem',
              textAlign: 'center',
              marginTop: '0.25rem',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: '1.25rem',
            }}
          >
            A daily drop of lyrical greatness — curated hip-hop bars with clean typography and
            smooth flow.
          </p>
          <p
            style={{
              fontSize: '0.75rem',
              textAlign: 'center',
              marginTop: '0.25rem',
              fontStyle: 'italic',
              color: '#FDBA74',
            }}
          >
            Supabase • Next.js • Tailwind
          </p>
        </a>
      </SafeSvgHtml>
    </CourtZone>
  )
}
