'use client'

import { CourtSvg } from './court/CourtSvg'
import { CourtContainer } from './court/CourtContainer'
import React, { useRef, useState, useMemo } from 'react'
import { useHasSeenTour } from '@/utils/useHasSeenTour'
import { CourtInteractionLayer } from './court/CourtInteractionLayer'
import { tourSteps } from '@/constants/tourSteps'
import { FreeRoamOverlay } from './FreeRoamOverlay'
import { MobileAdvanceOverlay } from './MobileAdvanceOverlay'
import { TutorialOverlay } from './TutorialOverlay'
import { useTourState } from './hooks/useTourState'
import { useZoneContent } from './hooks/useZoneContent'
import { useIsMobile } from '@/utils/hooks/useIsMobile'
import { useElementRect } from '@/utils/hooks/useElementRect'

export function HomeBody() {
  const { hasSeen, markAsSeen, reset } = useHasSeenTour()
  const isMobile = useIsMobile()
  const svgRef = useRef<SVGSVGElement>(null)

  const { tourActive, tourStep, startTour, nextStep, stopTour } = useTourState({
    hasSeen,
    markAsSeen,
  })

  const [clickTarget, setClickTarget] = useState<{ x: number; y: number } | null>(null)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const [lastTutorialPos, setLastTutorialPos] = useState<{ x: number; y: number }>({
    x: 650,
    y: 1500,
  })

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

  const displayedSteps = useMemo(() => {
    return tourSteps.map((step, index) => ({
      ...step,
      glow: isMobile && index === 0 ? undefined : step.glow,
      text: isMobile && step.mobileText ? step.mobileText : step.text,
    }))
  }, [isMobile])

  const currentStep = displayedSteps[tourStep]
  const targetRect = useElementRect(currentStep.targetId)

  const computedGlow = targetRect
    ? {
        x: targetRect.left,
        y: targetRect.top,
        width: targetRect.width,
        height: targetRect.height,
        shape: 'rectangle',
      }
    : currentStep.glow

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

      <TutorialOverlay
        active={tourActive}
        stepData={currentStep}
        glow={computedGlow}
        svgRef={svgRef}
        onPositionChange={setLastTutorialPos}
      />

      <FreeRoamOverlay
        active={!tourActive}
        target={clickTarget ?? lastTutorialPos}
        svgRef={svgRef}
      />

      <MobileAdvanceOverlay
        active={tourActive && isMobile}
        onAdvance={tourStep < tourSteps.length - 1 ? nextStep : stopTour}
      />
    </CourtContainer>
  )
}
