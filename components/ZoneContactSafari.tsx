'use client'

import { SafeSvgHtml } from '@/components/SafeSvgHtml'

/**
 * Safari-safe version of the Contact zone using inline styles and no backdrop filter.
 */
export function ZoneContactSafari() {
  return (
    <SafeSvgHtml>
      <div
        style={{
          backgroundColor: 'rgba(88, 44, 13, 0.85)',
          color: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 165, 0, 0.3)',
          fontSize: '0.75rem',
          textAlign: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#FDBA74', margin: 0 }}>
          📋 Scouting Inquiry
        </h3>
        <p style={{ marginTop: '0.25rem', color: 'rgba(255,255,255,0.9)', lineHeight: '1.25rem' }}>
          Let’s connect — for dream teams, pick-up ideas, or just a chat.
        </p>
        <ul style={{ marginTop: '0.5rem', paddingLeft: 0, listStyle: 'none', fontSize: '0.75rem' }}>
          <li>
            <strong>Email:</strong>{' '}
            <a
              href="mailto:lucasklawrence@gmail.com"
              style={{ color: '#FDBA74', textDecoration: 'underline' }}
            >
              lucasklawrence@gmail.com
            </a>
          </li>
          <li>
            <strong>LinkedIn:</strong>{' '}
            <a
              href="https://linkedin.com/in/lucasklawrence"
              target="_blank"
              style={{ color: '#FDBA74', textDecoration: 'underline' }}
            >
              /lucasklawrence
            </a>
          </li>
          <li>
            <strong>Resume:</strong>{' '}
            <a
              href="/LucasLawrenceResume.pdf"
              target="_blank"
              style={{ color: '#FDBA74', textDecoration: 'underline' }}
            >
              View PDF
            </a>
          </li>
        </ul>
      </div>
    </SafeSvgHtml>
  )
}
