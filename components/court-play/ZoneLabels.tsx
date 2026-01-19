'use client'

import type { CourtZone } from '@/features/court-plays/zones'

type Props = {
  zones: CourtZone[]
  activePrinciple: string | null
  activeShot: string | null
  onZoneClick?: (zone: CourtZone) => void
  clickEnabled?: boolean
  viewBox?: string
  className?: string
}

const TYPE_STYLES = {
  principle: {
    stroke: '#f97316',
    fill: 'rgba(249, 115, 22, 0.08)',
    fillActive: 'rgba(249, 115, 22, 0.22)',
    text: '#fed7aa',
    textActive: '#ffedd5',
    heading: 'Principles',
  },
  shot: {
    stroke: '#38bdf8',
    fill: 'rgba(56, 189, 248, 0.08)',
    fillActive: 'rgba(56, 189, 248, 0.22)',
    text: '#e0f2fe',
    textActive: '#f0f9ff',
    heading: 'Shots',
  },
}

const LEGEND_STYLES = {
  fill: 'rgba(15, 23, 42, 0.5)',
  stroke: 'rgba(148, 163, 184, 0.4)',
  label: '#cbd5f5',
  text: '#e2e8f0',
  ballFill: '#f59e0b',
  ballStroke: '#fef3c7',
  oStroke: '#e2e8f0',
  xStroke: '#fb7185',
  coneFill: 'rgba(249, 115, 22, 0.25)',
  coneStroke: '#f97316',
  arrowStroke: '#e2e8f0',
}

const LEGEND_ITEMS = [
  { id: 'ball', label: 'Ball' },
  { id: 'offense', label: 'Offense (O)' },
  { id: 'defense', label: 'Defense (X)' },
  { id: 'constraint', label: 'Constraint' },
  { id: 'direction', label: 'Direction' },
] as const

type LegendItemId = (typeof LEGEND_ITEMS)[number]['id']

export const PLAY_TABLET_STYLE = {
  padding: 16,
  headerHeight: 28,
  fill: 'rgba(15, 23, 42, 0.72)',
  stroke: 'rgba(148, 163, 184, 0.5)',
  label: '#e2e8f0',
}

export function getGroupBounds(zones: CourtZone[]) {
  const minX = Math.min(...zones.map(zone => zone.bounds.x))
  const minY = Math.min(...zones.map(zone => zone.bounds.y))
  const maxX = Math.max(...zones.map(zone => zone.bounds.x + zone.bounds.width))
  const maxY = Math.max(...zones.map(zone => zone.bounds.y + zone.bounds.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function getPlayTabletBounds(zones: CourtZone[]) {
  const allBounds = getGroupBounds(zones)
  return {
    x: allBounds.x - PLAY_TABLET_STYLE.padding,
    y: allBounds.y - PLAY_TABLET_STYLE.padding - PLAY_TABLET_STYLE.headerHeight,
    width: allBounds.width + PLAY_TABLET_STYLE.padding * 2,
    height: allBounds.height + PLAY_TABLET_STYLE.padding * 2 + PLAY_TABLET_STYLE.headerHeight,
  }
}

function renderLegendGlyph(type: LegendItemId) {
  const size = 12
  const half = size / 2

  if (type === 'ball') {
    return <circle r={half} fill={LEGEND_STYLES.ballFill} stroke={LEGEND_STYLES.ballStroke} strokeWidth={2} />
  }

  if (type === 'offense') {
    return <circle r={half} fill="none" stroke={LEGEND_STYLES.oStroke} strokeWidth={2} />
  }

  if (type === 'defense') {
    return (
      <g stroke={LEGEND_STYLES.xStroke} strokeWidth={2} strokeLinecap="round">
        <line x1={-half} y1={-half} x2={half} y2={half} />
        <line x1={-half} y1={half} x2={half} y2={-half} />
      </g>
    )
  }

  if (type === 'constraint') {
    return (
      <polygon
        points={`0,${-half} ${half},${half} ${-half},${half}`}
        fill={LEGEND_STYLES.coneFill}
        stroke={LEGEND_STYLES.coneStroke}
        strokeWidth={2}
      />
    )
  }

  return (
    <path
      d="M -6 2 L 0 -6 L 6 2 M 0 -6 L 0 8"
      fill="none"
      stroke={LEGEND_STYLES.arrowStroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

export function ZoneLabels({
  zones,
  activePrinciple,
  activeShot,
  onZoneClick,
  clickEnabled = false,
  viewBox = '0 0 1536 1024',
  className,
}: Props) {
  const principleZones = zones.filter(zone => zone.type === 'principle')
  const shotZones = zones.filter(zone => zone.type === 'shot')

  const principleBounds = getGroupBounds(principleZones)
  const shotBounds = getGroupBounds(shotZones)
  const panel = getPlayTabletBounds(zones)
  const legendPadding = 10
  const legendHeaderHeight = 14
  const legendItemHeight = 22
  const legendHeight =
    legendPadding * 2 + legendHeaderHeight + LEGEND_ITEMS.length * legendItemHeight
  const legendX = shotBounds.x
  const legendY = panel.y + panel.height - legendHeight - 12
  const legendWidth = shotBounds.width

  return (
    <div className={`h-full w-full ${clickEnabled ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <svg
        viewBox={viewBox}
        className={className ?? 'w-full h-full'}
        preserveAspectRatio="xMinYMin meet"
      >
        <g id="play-tablet">
          <rect
            x={panel.x}
            y={panel.y}
            width={panel.width}
            height={panel.height}
            rx={20}
            ry={20}
            fill={PLAY_TABLET_STYLE.fill}
            stroke={PLAY_TABLET_STYLE.stroke}
            strokeWidth={2}
          />
          <text
            x={panel.x + panel.width / 2}
            y={panel.y + 20}
            textAnchor="middle"
            fill={PLAY_TABLET_STYLE.label}
            fontSize={12}
            fontWeight={700}
            letterSpacing={2}
          >
            PLAY TABLET
          </text>
        </g>
        <g id="principle-zones">
          <text
            x={principleBounds.x + principleBounds.width / 2}
            y={principleBounds.y - 16}
            textAnchor="middle"
              fill={TYPE_STYLES.principle.text}
              fontSize={13}
              fontWeight={700}
              letterSpacing={2}
            >
              {TYPE_STYLES.principle.heading.toUpperCase()}
            </text>
          {principleZones.map(zone => {
            const isActive = zone.principleId === activePrinciple
            const fill = isActive ? TYPE_STYLES.principle.fillActive : TYPE_STYLES.principle.fill
            const text = isActive ? TYPE_STYLES.principle.textActive : TYPE_STYLES.principle.text
            return (
              <g
                key={zone.id}
                onClick={clickEnabled ? () => onZoneClick?.(zone) : undefined}
                style={{ cursor: clickEnabled ? 'pointer' : 'default' }}
              >
                <rect
                  x={zone.bounds.x}
                  y={zone.bounds.y}
                  width={zone.bounds.width}
                  height={zone.bounds.height}
                  rx={14}
                  ry={14}
                  fill={fill}
                  stroke={TYPE_STYLES.principle.stroke}
                  strokeWidth={isActive ? 3 : 2}
                />
                <text
                  x={zone.bounds.x + zone.bounds.width / 2}
                  y={zone.bounds.y + zone.bounds.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={text}
                  fontSize={18}
                  fontWeight={700}
                >
                  {zone.label}
                </text>
              </g>
            )
          })}
        </g>

        <g id="shot-zones">
          <text
            x={shotBounds.x + shotBounds.width / 2}
            y={shotBounds.y - 16}
            textAnchor="middle"
              fill={TYPE_STYLES.shot.text}
              fontSize={13}
              fontWeight={700}
              letterSpacing={2}
            >
              {TYPE_STYLES.shot.heading.toUpperCase()}
            </text>
          {shotZones.map(zone => {
            const isActive = zone.shotId === activeShot
            const fill = isActive ? TYPE_STYLES.shot.fillActive : TYPE_STYLES.shot.fill
            const text = isActive ? TYPE_STYLES.shot.textActive : TYPE_STYLES.shot.text
            return (
              <g
                key={zone.id}
                onClick={clickEnabled ? () => onZoneClick?.(zone) : undefined}
                style={{ cursor: clickEnabled ? 'pointer' : 'default' }}
              >
                <rect
                  x={zone.bounds.x}
                  y={zone.bounds.y}
                  width={zone.bounds.width}
                  height={zone.bounds.height}
                  rx={14}
                  ry={14}
                  fill={fill}
                  stroke={TYPE_STYLES.shot.stroke}
                  strokeWidth={isActive ? 3 : 2}
                />
                <text
                  x={zone.bounds.x + zone.bounds.width / 2}
                  y={zone.bounds.y + zone.bounds.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={text}
                  fontSize={18}
                  fontWeight={700}
                >
                  {zone.label}
                </text>
              </g>
            )
          })}
        </g>

        <g id="legend" pointerEvents="none">
          <rect
            x={legendX}
            y={legendY}
            width={legendWidth}
            height={legendHeight}
            rx={12}
            ry={12}
            fill={LEGEND_STYLES.fill}
            stroke={LEGEND_STYLES.stroke}
            strokeWidth={1.5}
          />
          <text
            x={legendX + legendWidth / 2}
            y={legendY + legendPadding + legendHeaderHeight}
            textAnchor="middle"
            fill={LEGEND_STYLES.label}
            fontSize={11}
            fontWeight={700}
            letterSpacing={2}
          >
            LEGEND
          </text>
          {LEGEND_ITEMS.map((item, index) => {
            const itemY = legendY + legendPadding + legendHeaderHeight + 12 + index * legendItemHeight
            const iconX = legendX + 18
            const textX = legendX + 36
            return (
              <g key={item.id} transform={`translate(${iconX} ${itemY})`}>
                {renderLegendGlyph(item.id)}
                <text x={textX - iconX} y={4} fill={LEGEND_STYLES.text} fontSize={12}>
                  {item.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
