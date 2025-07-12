import React from 'react'
import { SafeSvgHtml } from '../common/SafeSvgHtml'

type Props = {
  x: number
  y: number
  width: number
  height: number
  zoneId?: string
  onClick?: (zoneId: string) => void
  children: React.ReactNode
}

/**
 * LockerZone is a wrapper component that renders a <foreignObject> at specified
 * coordinates within the locker room SVG. It allows interactive HTML or React
 * components to be positioned inside individual lockers.
 *
 * If `zoneId` and `onClick` are provided, clicking this zone will trigger selection.
 */
export function LockerZone({ x, y, width, height, zoneId, onClick, children }: Props) {
  const handleClick = () => {
    if (zoneId && onClick) onClick(zoneId)
  }

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      className="pointer-events-auto cursor-pointer"
    >
      <foreignObject width={width} height={height}>
        <SafeSvgHtml>{children}</SafeSvgHtml>
      </foreignObject>
    </g>
  )
}
