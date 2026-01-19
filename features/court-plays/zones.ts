export const COURT_VIEWBOX = { width: 1536, height: 1024 }

export type CourtZoneType = 'principle' | 'shot' | 'context'

export type ZoneBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type CourtZone = {
  id: string
  type: CourtZoneType
  label: string
  bounds: ZoneBounds
  principleId?: string
  shotId?: string
  contextId?: string
}

const ZONE_WIDTH = 200
const ZONE_HEIGHT = 56
const ZONE_GAP = 8
const ZONE_START_Y = 468

const PANEL_X = 1020
const PANEL_PADDING = 14
const COLUMN_GAP = 18

const PRINCIPLE_X = PANEL_X + PANEL_PADDING
const SHOT_X = PRINCIPLE_X + ZONE_WIDTH + COLUMN_GAP
const SHOT_START_Y = ZONE_START_Y

const PRINCIPLES = [
  { id: 'clarity', label: 'Clarity' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'scalability', label: 'Scalability' },
  { id: 'testing', label: 'Testing' },
  { id: 'observability', label: 'Observability' },
  { id: 'craft', label: 'Craft' },
] as const

const SHOTS = [
  { id: 'drive', label: 'Drive' },
  { id: 'kickout', label: 'Kick Out' },
  { id: 'reset', label: 'Reset' },
] as const

export const COURT_ZONES: CourtZone[] = [
  ...PRINCIPLES.map((principle, index) => ({
    id: `principle.${principle.id}`,
    type: 'principle' as const,
    label: principle.label,
    bounds: {
      x: PRINCIPLE_X,
      y: ZONE_START_Y + (ZONE_HEIGHT + ZONE_GAP) * index,
      width: ZONE_WIDTH,
      height: ZONE_HEIGHT,
    },
    principleId: principle.id,
  })),
  ...SHOTS.map((shot, index) => ({
    id: `shot.${shot.id}`,
    type: 'shot' as const,
    label: shot.label,
    bounds: {
      x: SHOT_X,
      y: SHOT_START_Y + (ZONE_HEIGHT + ZONE_GAP) * index,
      width: ZONE_WIDTH,
      height: ZONE_HEIGHT,
    },
    shotId: shot.id,
  })),
]

export type AnchorPoint = { x: number; y: number }

export const ANCHORS: Record<string, AnchorPoint> = {
  'anchor.topKey': { x: 460, y: 420 },
  'anchor.paint': { x: 340, y: 520 },
  'anchor.arcLeft': { x: 260, y: 430 },
  'anchor.arcRight': { x: 590, y: 430 },
  'anchor.arcTop': { x: 460, y: 320 },
  'anchor.playStartLeft': { x: 520, y: 720 },
  'anchor.playCallout': { x: 1180, y: 390 },
  'anchor.player': { x: 768, y: 820 },
}
