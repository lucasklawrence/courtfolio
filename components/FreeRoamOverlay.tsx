'use client'

import { FreeRoamPlayer } from './court/FreeRoamPlayer'

type Props = {
  active: boolean
  target: { x: number; y: number } | null
  svgRef: React.RefObject<SVGSVGElement | null>
}

export function FreeRoamOverlay({ active, target, svgRef }: Props) {
  if (!active) return null

  return (
    <div className="absolute top-0 left-0 w-full h-full z-50 pointer-events-none">
      <FreeRoamPlayer boundsRef={svgRef} target={target} />
    </div>
  )
}
