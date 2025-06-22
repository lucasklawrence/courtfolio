'use client'

/**
 * Safari-compatible career stats card using inline styles for `<foreignObject>`.
 */
export function ZoneCareerStatsSafari() {
  return (
    <div
      style={{
        backgroundColor: 'rgba(88, 44, 13, 0.7)',
        color: 'white',
        padding: '1rem',
        borderRadius: '0.5rem',
        border: '1px solid rgba(255, 165, 0, 0.3)',
        fontSize: '0.75rem',
        fontFamily: 'sans-serif',
        lineHeight: '1.25rem',
      }}
    >
      <h3
        style={{
          fontSize: '0.875rem',
          fontWeight: 'bold',
          color: '#FDBA74',
          textAlign: 'center',
          marginTop: 0,
          marginBottom: '0.5rem',
        }}
      >
        📊 Career Stats
      </h3>
      <ul style={{ paddingLeft: '1rem', margin: 0 }}>
        <li>
          <strong>Years on Court:</strong> 10+
        </li>
        <li>
          <strong>Patents:</strong> 1 (Low Latency Packet Sync)
        </li>
        <li>
          <strong>Roles:</strong> Senior Eng, Team Lead
        </li>
        <li>
          <strong>Specialties:</strong> Java, Spring, Kubernetes, DDD
        </li>
      </ul>
    </div>
  )
}
