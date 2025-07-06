'use client'

import { useMemo } from 'react'
import { TourStep } from '@/constants/tourSteps'
import { CourtTutorialSprite } from './CourtTutorialSprite'
import { SvgGlowHighlight } from '../common/SvgGlowingHighlight'

type Props = {
  /**
   * Whether the tutorial overlay is active and should render.
   */
  active: boolean

  /**
   * The current tutorial step data, including targetId and optional padding.
   */
  stepData: TourStep

  /**
   * Optional static glow data if targetId cannot be resolved.
   */
  glow?: {
    x: number
    y: number
    width: number
    height: number
    shape?: string
  }

  /**
   * Ref to the root SVG element for coordinate transformation.
   */
  svgRef: React.RefObject<SVGSVGElement | null>

  /**
   * Optional callback when the tutorial sprite changes position.
   */
  onPositionChange?: (pt: { x: number; y: number }) => void
}

/**
 * Computes SVG coordinate bounds from a DOM target inside the SVG layer,
 * converting from screen space to viewBox coordinates.
 *
 * @param targetId - The HTML element ID to highlight.
 * @param svg - The SVG container element.
 * @param paddingFactor - Optional zoom-out factor to grow the highlight box.
 * @returns Highlight bounds in SVG coordinate space, or null if unavailable.
 */
function getGlowBoundsFromTarget(targetId: string, svg: SVGSVGElement | null, paddingFactor = 1.1) {
  if (!svg) return null
  const target = document.getElementById(targetId)
  if (!target) return null

  const targetRect = target.getBoundingClientRect()
  const ctm = svg.getScreenCTM()?.inverse()
  if (!ctm) return null

  const pt = svg.createSVGPoint()

  // Top-left
  pt.x = targetRect.left
  pt.y = targetRect.top
  const topLeft = pt.matrixTransform(ctm)

  // Bottom-right
  pt.x = targetRect.left + targetRect.width
  pt.y = targetRect.top + targetRect.height
  const bottomRight = pt.matrixTransform(ctm)

  const width = (bottomRight.x - topLeft.x) * paddingFactor
  const height = (bottomRight.y - topLeft.y) * paddingFactor

  return {
    x: topLeft.x,
    y: topLeft.y,
    width,
    height,
  }
}

/**
 * TutorialOverlay
 *
 * Displays an SVG-based highlight over a court zone or element, and renders a sprite
 * to guide the user through interactive onboarding steps.
 */
export function TutorialOverlay({ active, stepData, glow, svgRef, onPositionChange }: Props) {
  const glowBounds = useMemo(() => {
    if (!active) return null

    const padding = typeof stepData.paddingFactor === 'number' ? stepData.paddingFactor : 1.1

    if (stepData.targetId && svgRef.current) {
      return getGlowBoundsFromTarget(stepData.targetId, svgRef.current, padding)
    }

    return glow ?? null
  }, [active, stepData.targetId, stepData.paddingFactor, glow, svgRef])

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

      <CourtTutorialSprite
        svgRef={svgRef}
        stepData={stepData}
        onPositionChange={onPositionChange}
      />
    </div>
  )
}
