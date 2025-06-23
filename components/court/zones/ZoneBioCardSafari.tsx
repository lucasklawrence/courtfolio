'use client'

import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import React from 'react'

/**
 * Safari-safe version of the Bio Card using inline styles only
 * without backdrop blur or div nesting issues.
 */
export function ZoneBioCardSafari() {
  return (
    <SafeSvgHtml>
      <div
        style={{
          backgroundColor: 'rgba(88, 44, 13, 0.9)',
          color: 'white',
          padding: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 165, 0, 0.3)',
          fontSize: '0.875rem',
          textAlign: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#FDBA74', margin: 0 }}>
          Lucas Lawrence
        </h2>
        <p style={{ fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>
          🏀 Senior Software Engineer & Technical Playmaker
        </p>
        <p style={{ fontSize: '0.75rem', lineHeight: '1.25rem', marginTop: '0.5rem' }}>
          I build scalable systems, design clean APIs, and coach full-stack teams. From court vision
          to execution.
        </p>
      </div>
    </SafeSvgHtml>
  )
}
