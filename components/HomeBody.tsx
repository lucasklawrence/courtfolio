'use client'

import React, { useMemo, useRef, useState } from 'react'
import { SvgLayoutContainer } from './common/SvgLayoutContainer'
import { CourtSvg } from './court/CourtSvg'
import { CourtInteractionLayer } from './court/CourtInteractionLayer'
import { TutorialOverlay } from './court/TutorialOverlay'
import { FreeRoamOverlay } from './court/FreeRoamOverlay'
import { MobileAdvanceOverlay } from './court/MobileAdvanceOverlay'

import { useIsMobile } from '@/utils/hooks/useIsMobile'
import { useTourState } from '@/utils/hooks/useTourState'
import { useZoneContent } from '@/utils/hooks/useZoneContent'
import { useElementRect } from '@/utils/hooks/useElementRect'
import { useHasSeenTour } from '@/utils/useHasSeenTour'
import { tourSteps } from '@/constants/tourSteps'

export function HomeBody() {
  const svgRef = useRef<SVGSVGElement>(null)
  const isMobile = useIsMobile()
  const { hasSeen, markAsSeen, reset } = useHasSeenTour()

  const { tourActive, tourStep, startTour, nextStep, stopTour } = useTourState({
    hasSeen,
    markAsSeen,
  })

  const [clickTarget, setClickTarget] = useState<{ x: number; y: number } | null>(null)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])
  const [lastTutorialPos, setLastTutorialPos] = useState({ x: 650, y: 1500 })

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

  const displayedSteps = useMemo(
    () =>
      tourSteps.map((step, index) => ({
        ...step,
        glow: isMobile && index === 0 ? undefined : step.glow,
        text: isMobile && step.mobileText ? step.mobileText : step.text,
      })),
    [isMobile]
  )

  const currentStep = displayedSteps[tourStep] ?? tourSteps[0] // fallback just in case
  const targetRect = useElementRect(currentStep?.targetId)

  const computedGlow = useMemo(() => {
    if (targetRect) {
      return {
        x: targetRect.left,
        y: targetRect.top,
        width: targetRect.width,
        height: targetRect.height,
        shape: 'rectangle' as const,
      }
    }
    return currentStep?.glow
  }, [targetRect, currentStep?.glow])

  return (
    <SvgLayoutContainer>
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
    </SvgLayoutContainer>
  )
}
