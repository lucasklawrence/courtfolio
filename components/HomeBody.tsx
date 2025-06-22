'use client'

import { CourtSvg } from './court/CourtSvg'
import { useRouter } from 'next/navigation'
import { CourtContainer } from './court/CourtContainer'
import React, { useRef, useState } from 'react'
import { useHasSeenTour } from '@/utils/useHasSeenTour'
import { CourtInteractionLayer } from './court/CourtInteractionLayer'
import { useWindowSize } from '@/utils/useWindowSize'
import { tourSteps } from '@/constants/tourSteps'
import { FreeRoamOverlay } from './FreeRoamOverlay'
import { MobileAdvanceOverlay } from './MobileAdvanceOverlay'
import { TutorialOverlay } from './TutorialOverlay'
import { useTourState } from './hooks/useTourState'
import { useZoneContent } from './hooks/useZoneContent'

export function HomeBody() {
  const router = useRouter()
  const { hasSeen, markAsSeen, reset } = useHasSeenTour()
  const { width } = useWindowSize()
  const isMobile = width <= 768
  const svgRef = useRef<SVGSVGElement>(null)

  const {
    tourActive,
    tourStep,
    startTour,
    nextStep,
    stopTour,
  } = useTourState({ hasSeen, markAsSeen })

  const [clickTarget, setClickTarget] = useState<{ x: number; y: number } | null>(null)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])

  const zoneContent = useZoneContent({
    tourActive,
    tourStep,
    isMobile,
    hasSeen,
    markAsSeen,
    startTour,
    stopTour,
    nextStep,
    reset,
  })

  return (
    <CourtContainer>
      <CourtSvg
        ref={svgRef}
        className="w-full h-full"
        zoneContent={zoneContent}
        ripples={ripples}
      />

      <CourtInteractionLayer
        svgRef={svgRef}
        setClickTarget={tourActive ? () => {} : setClickTarget}
        setRipples={tourActive ? () => {} : setRipples}
        disabled={tourActive}
      />

      <TutorialOverlay active={tourActive} stepData={tourSteps[tourStep]} svgRef={svgRef} />
      <FreeRoamOverlay active={!tourActive} target={clickTarget} svgRef={svgRef} />
      <MobileAdvanceOverlay
        active={tourActive && isMobile}
        onAdvance={
          tourStep < tourSteps.length - 1
            ? nextStep
            : stopTour
        }
      />
    </CourtContainer>
  )
}
