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
        backgroundColor: 'transparent',
        color: 'white',
        padding: '1rem',
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        textAlign: 'center',
        fontFamily: '"Patrick Hand", cursive',
      }}
    >
        {/* Left side */}
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#FDBA74', margin: 0 }}>
            📋 Scouting Inquiry
          </h3>
          <p style={{ marginTop: '0.25rem', color: 'rgba(255,255,255,0.9)' }}>
            Let’s connect — for dream teams, pick-up ideas, or just a chat.
          </p>
          <ul style={{ paddingLeft: 0, listStyle: 'none', marginTop: '0.5rem' }}>
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
          </ul>

          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ color: '#FDBA74', fontWeight: 'bold', marginBottom: '0.25rem' }}>
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

        {/* Right side */}
        <div style={{ width: '45%' }}>
          <div>
            <h4 style={{ color: '#FDBA74', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              Season Highlights
            </h4>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Architected cloud-native NMS</li>
              <li>Led secure microservice migration</li>
            </ul>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ color: '#FDBA74', fontWeight: 'bold', marginBottom: '0.25rem' }}>
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
            <h4 style={{ color: '#FDBA74', fontWeight: 'bold', marginBottom: '0.25rem' }}>
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
          color: '#ccc',
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
