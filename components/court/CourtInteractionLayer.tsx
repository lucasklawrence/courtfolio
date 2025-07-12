'use client'

import React, { useEffect, useCallback } from 'react'
/**
 * Represents a ripple effect triggered by a user tap on the court.
 * Used to animate feedback at a specific point within the SVG coordinate space.
 */
type Ripple = {
  /** Unique identifier for the ripple (e.g., timestamp-based) */
  id: number

  /** X position within the SVG coordinate space */
  x: number

  /** Y position within the SVG coordinate space */
  y: number
}

/**
 * Props for the `CourtInteractionLayer` component, which handles user interaction
 * (taps/clicks) on the court SVG and triggers visual feedback such as ripples.
 */
type CourtInteractionLayerProps = {
  /**
   * Ref to the SVG element used for coordinate transformation and event binding.
   */
  svgRef: React.RefObject<SVGSVGElement | null>

  /**
   * Callback to set the local (pixel-based) click target,
   * used for positioning overlays like tooltips or the free-roam sprite.
   */
  setClickTarget: (pt: { x: number; y: number }) => void

  /**
   * Setter for the list of ripple effects triggered by taps.
   * New ripples are appended to the current array.
   */
  setRipples: React.Dispatch<React.SetStateAction<Ripple[]>>

  /**
   * Optional flag to disable interaction handling (e.g. during an onboarding tour).
   * Defaults to `false`.
   */
  disabled?: boolean
}

/**
 * CourtInteractionLayer
 *
 * Adds pointer-based interaction support to the court SVG.
 * Handles single-finger taps to set a ripple effect and trigger logic.
 * Multi-touch gestures (like pinch-to-zoom) are intentionally ignored to allow native behavior.
 */
export function CourtInteractionLayer({
  svgRef,
  setClickTarget,
  setRipples,
  disabled = false,
}: CourtInteractionLayerProps) {
  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (disabled) return

      // Ignore non-touch or non-mouse events (e.g. pen input)
      if (e.pointerType !== 'touch' && e.pointerType !== 'mouse') return

      // Ignore secondary touch points or wide touches (pinch, multi-finger)
      if (
        e.pointerType === 'touch' &&
        (!e.isPrimary || e.width > 40 || e.height > 40)
      ) {
        return
      }

      const target = e.target as HTMLElement
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('.ui-ignore')
      ) {
        return
      }

      const svg = svgRef.current
      if (!svg) return

      const bounds = svg.getBoundingClientRect()

      // Convert pointer location to SVG coordinate space
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY

      const svgCoords = pt.matrixTransform(svg.getScreenCTM()?.inverse())
      const rippleX = svgCoords.x
      const rippleY = svgCoords.y

      const localX = e.clientX - bounds.left
      const localY = e.clientY - bounds.top

      setClickTarget({ x: localX, y: localY })
      setRipples(prev => [...prev, { id: Date.now(), x: rippleX, y: rippleY }])
    },
    [svgRef, disabled, setClickTarget, setRipples]
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    svg.addEventListener('pointerup', handlePointerUp)

    return () => {
      svg.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerUp])

  return null
}
