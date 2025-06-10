import React from 'react'
import { SafeSvgHtml } from '../SafeSvgHtml'

/**
 * LockerZone is a wrapper component that renders a <foreignObject> at specified
 * coordinates within the locker room SVG. It allows interactive HTML or React
 * components to be positioned inside individual lockers.
 *
 * Automatically wraps content in XHTML-safe <div> for cross-browser compatibility.
 *
 * @param {number} x - The x-coordinate of the zone on the SVG canvas.
 * @param {number} y - The y-coordinate of the zone.
 * @param {number} width - The width of the content area.
 * @param {number} height - The height of the content area.
 * @param {React.ReactNode} children - The content to render inside the locker.
 *
 * @example
 * <LockerZone x={1205} y={153} width={160} height={96}>
 *   <DadJerseySVG className="w-14" />
 * </LockerZone>
 */
export function LockerZone({
  x,
  y,
  width,
  height,
  children,
}: {
  x: number
  y: number
  width: number
  height: number
  children: React.ReactNode
}) {
  return (
    <foreignObject x={x} y={y} width={width} height={height}>
      <SafeSvgHtml>{children}</SafeSvgHtml>
    </foreignObject>
  )
}
