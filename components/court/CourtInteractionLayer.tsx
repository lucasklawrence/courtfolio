'use client'

import React, { useEffect, useCallback } from 'react'

type Ripple = { id: number; x: number; y: number }

type CourtInteractionLayerProps = {
  svgRef: React.RefObject<SVGSVGElement | null>
  setClickTarget: (pt: { x: number; y: number }) => void
  setRipples: React.Dispatch<React.SetStateAction<Ripple[]>>
  disabled?: boolean
}

export function CourtInteractionLayer({
  svgRef,
  setClickTarget,
  setRipples,
  disabled = false,
}: CourtInteractionLayerProps) {
  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (disabled) return

      const target = e.target as HTMLElement
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('.ui-ignore')
      ) {
        return
      }

      if (e.pointerType === 'touch' && !e.isPrimary) return
      if (e.pointerType !== 'touch' && e.pointerType !== 'mouse') return

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
