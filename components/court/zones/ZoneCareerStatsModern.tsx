'use client'

/**
 * Career stats card using Tailwind CSS and modern browser features.
 */
export function ZoneCareerStatsModern() {
  return (
    <div className="bg-orange-900/70 text-white p-4 rounded-lg border border-orange-400/30 shadow-sm space-y-1 text-xs">
      <h3 className="text-sm font-bold text-orange-300 text-center">📊 Career Stats</h3>
      <ul className="space-y-1">
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
