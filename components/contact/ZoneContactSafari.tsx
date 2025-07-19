'use client'

import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'

export function ZoneContactSafari() {
  return (
    <SafeSvgHtml>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          fontSize: '0.75rem',
          lineHeight: '1.25rem',
          color: '#222',
          padding: '0.5rem',
          fontFamily: 'sans-serif',
          textAlign: 'left',
        }}
      >
        {/* Left column */}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fb923c', margin: 0 }}>
            Scouting Inquiry
          </h3>
          <p style={{ marginTop: '0.25rem' }}>
            Let’s connect — for dream teams, pick-up ideas, or just a chat.
          </p>
          <ul style={{ paddingLeft: 0, listStyle: 'none', marginTop: '0.5rem' }}>
            <li>
              <strong>Email:</strong>{' '}
              <a
                href="mailto:lucasklawrence@gmail.com"
                style={{ color: '#0369a1', textDecoration: 'underline' }}
              >
                lucasklawrence@gmail.com
              </a>
            </li>
            <li>
              <strong>LinkedIn:</strong>{' '}
              <a
                href="https://linkedin.com/in/lucasklawrence"
                target="_blank"
                style={{ color: '#0369a1', textDecoration: 'underline' }}
              >
                /in/lucasklawrence
              </a>
            </li>
          </ul>

          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ color: '#fb923c', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              Scouting Report
            </h4>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Position: Full-Stack Playmaker</li>
              <li>Strengths: React handles, Java core, court vision in architecture</li>
              <li>Court IQ: High – reads legacy systems, system player</li>
              <li>Leadership: Floor general who lifts the squad</li>
            </ul>
          </div>
        </div>

        {/* Right column */}
        <div style={{ width: '45%' }}>
          <div>
            <h4 style={{ color: '#fb923c', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              Season Highlights
            </h4>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Architected cloud-native NMS</li>
              <li>Led secure microservice migration</li>
            </ul>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ color: '#fb923c', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              Shot Range
            </h4>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>🟢 React & Next.js — deep range</li>
              <li>🟢 Spring Boot — automatic in the lane</li>
              <li>🟡 Kafka & gRPC — confident midrange</li>
              <li>🔵 SVG & D3 — crafty finishes</li>
            </ul>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ color: '#fb923c', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              Free Agent Notes
            </h4>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Open to dream teams with creativity + scale</li>
              <li>Values joyful tooling and clean systems</li>
            </ul>
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: '0.625rem',
          color: '#666',
          fontStyle: 'italic',
          textAlign: 'center',
          marginTop: '0.75rem',
        }}
      >
        "Plays drawn in code. Championships built in commits."
      </div>
    </SafeSvgHtml>
  )
}
