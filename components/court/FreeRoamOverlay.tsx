'use client'

import { FreeRoamPlayer } from './FreeRoamPlayer'

type Props = {
  active: boolean
  target: { x: number; y: number } | null
  svgRef: React.RefObject<SVGSVGElement | null>
  onPositionChange?: (pt: { x: number; y: number }) => void
}

export function FreeRoamOverlay({ active, target, svgRef, onPositionChange }: Props) {
  if (!active) return null

  return (
    <div className="absolute top-0 left-0 w-full h-full z-50 pointer-events-none">
      <FreeRoamPlayer boundsRef={svgRef} target={target} onPositionChange={onPositionChange} />
    </div>
  )
}
