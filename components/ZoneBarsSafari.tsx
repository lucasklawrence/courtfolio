'use client'

import { SafeSvgHtml } from '@/components/SafeSvgHtml'

/**
 * Safari-compatible version of Bars of the Day project zone.
 * Uses inline styles inside SafeSvgHtml to avoid <foreignObject> rendering issues.
 */
export function ZoneBarsSafari() {
  return (
    <SafeSvgHtml>
      <a
        href="https://barsoftheday.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          backgroundColor: 'rgba(38, 20, 4, 0.9)',
          color: 'white',
          padding: '1rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(255, 165, 0, 0.3)',
          textDecoration: 'none',
        }}
      >
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: '#FDBA74',
            textAlign: 'center',
          }}
        >
          🎤 Bars of the Day
        </h3>
        <p
          style={{
            fontSize: '0.75rem',
            textAlign: 'center',
            marginTop: '0.5rem',
            lineHeight: '1.2rem',
            color: '#fff',
          }}
        >
          A daily drop of lyrical greatness — curated hip-hop bars with clean typography and smooth
          flow.
        </p>
        <p
          style={{
            fontSize: '0.75rem',
            fontStyle: 'italic',
            color: '#fb923c',
            textAlign: 'center',
            marginTop: '0.25rem',
          }}
        >
          Supabase • Next.js • Tailwind
        </p>
      </a>
    </SafeSvgHtml>
  )
}
