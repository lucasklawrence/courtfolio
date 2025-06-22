'use client'

import { useMemo } from 'react'
import { CourtTutorialSprite } from './court/CourtTutorialSprite'
import { TourStep } from '@/constants/tourSteps'
import { SvgGlowHighlight } from './SvgGlowingHighlight'

type Props = {
  active: boolean
  stepData: TourStep
  glow?: {
    x: number
    y: number
    width: number
    height: number
    shape?: string
  }
  svgRef: React.RefObject<SVGSVGElement | null>
}

function getGlowBoundsFromTarget(targetId: string, svg: SVGSVGElement | null, paddingFactor = 1.1) {
  if (!svg) return null

  const target = document.getElementById(targetId)
  if (!target) return null

  const targetRect = target.getBoundingClientRect()

  const svgPoint = svg.createSVGPoint()
  const ctm = svg.getScreenCTM()?.inverse()
  if (!ctm) return null

  // Top-left corner
  svgPoint.x = targetRect.left
  svgPoint.y = targetRect.top
  const topLeft = svgPoint.matrixTransform(ctm)

  // Bottom-right corner
  svgPoint.x = targetRect.left + targetRect.width
  svgPoint.y = targetRect.top + targetRect.height
  const bottomRight = svgPoint.matrixTransform(ctm)

  const x = topLeft.x
  const y = topLeft.y
  const width = (bottomRight.x - topLeft.x) * paddingFactor
  const height = (bottomRight.y - topLeft.y) * paddingFactor

  return { x, y, width, height }
}

export function TutorialOverlay({ active, stepData, glow, svgRef }: Props) {
  const glowBounds = useMemo(() => {
    if (stepData.targetId && svgRef.current) {
      return getGlowBoundsFromTarget(
        stepData.targetId,
        svgRef.current,
        (stepData as any).paddingFactor ?? 1.1
      )
    }
    return glow
  }, [stepData.targetId, (stepData as any).paddingFactor, glow, svgRef])

  if (!active) return null

  return (
    <div className="absolute top-0 left-0 w-full h-full z-40 pointer-events-none">
      {glowBounds && (
        <svg
          className="absolute top-0 left-0 w-full h-full z-40 pointer-events-none"
          viewBox="0 0 1536 1024"
          preserveAspectRatio="xMidYMid meet"
        >
          <SvgGlowHighlight
            x={glowBounds.x}
            y={glowBounds.y}
            width={glowBounds.width}
            height={glowBounds.height}
            shape={glow?.shape}
          />
        </svg>
      )}

      <CourtTutorialSprite svgRef={svgRef} stepData={stepData} />
    </div>
  )
}
