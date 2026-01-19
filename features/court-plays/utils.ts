import { CourtZone, ZoneBounds } from './zones'

const ZONE_PRIORITY: Record<CourtZone['type'], number> = {
  principle: 3,
  shot: 2,
  context: 1,
}

export function isPointInBounds(x: number, y: number, bounds: ZoneBounds) {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  )
}

export function getZoneCenter(bounds: ZoneBounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

export function findZoneAtPoint(zones: CourtZone[], x: number, y: number): CourtZone | null {
  const matches = zones.filter(zone => isPointInBounds(x, y, zone.bounds))
  if (matches.length === 0) return null
  return matches.sort((a, b) => ZONE_PRIORITY[b.type] - ZONE_PRIORITY[a.type])[0] ?? null
}
