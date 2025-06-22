'use client'

import { CourtTutorialSprite } from './court/CourtTutorialSprite'
import { TourStep } from '@/constants/tourSteps'

type Props = {
  active: boolean
  stepData: TourStep
  svgRef: React.RefObject<SVGSVGElement | null>
}

export function TutorialOverlay({ active, stepData, svgRef }: Props) {
  if (!active) return null

  return (
    <div className="absolute top-0 left-0 w-full h-full z-50 pointer-events-none">
      <CourtTutorialSprite svgRef={svgRef} stepData={stepData} />
    </div>
  )
}
