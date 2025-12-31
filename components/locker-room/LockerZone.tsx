import React, { KeyboardEvent } from 'react'
import { SafeSvgHtml } from '../common/SafeSvgHtml'
import { lockerZoneTooltips } from './LockerInfo'
import { LockerZoneId } from './types'

type Props = {
  x: number
  y: number
  width: number
  height: number
  zoneId?: LockerZoneId
  onClick?: (zoneId: LockerZoneId) => void
  ariaLabel?: string
  children: React.ReactNode
}

/**
 * LockerZone is a wrapper component that renders a <foreignObject> at specified
 * coordinates within the locker room SVG. It allows interactive HTML or React
 * components to be positioned inside individual lockers.
 *
 * If `zoneId` and `onClick` are provided, clicking this zone will trigger selection.
 * Keyboard: Enter/Space also trigger selection for accessibility when clickable.
 */
export function LockerZone({ x, y, width, height, zoneId, onClick, ariaLabel, children }: Props) {
  const handleClick = () => {
    if (zoneId && onClick) onClick(zoneId)
  }

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (!zoneId || !onClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick(zoneId)
    }
  }

  const isInteractive = Boolean(zoneId && onClick)
  const label = ariaLabel ?? (zoneId ? (lockerZoneTooltips[zoneId]?.title ?? zoneId) : undefined)

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? label : undefined}
      className={isInteractive ? 'cursor-pointer' : undefined}
    >
      <foreignObject width={width} height={height}>
        <SafeSvgHtml>{children}</SafeSvgHtml>
      </foreignObject>
    </g>
  )
}
