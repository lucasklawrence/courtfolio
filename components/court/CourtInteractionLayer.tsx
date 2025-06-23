'use client'

import React, { useEffect } from 'react'

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
  disabled,
}: CourtInteractionLayerProps) {
  const handlePointerUp = (e: PointerEvent) => {
    if (disabled) return

    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('.ui-ignore')
    )
      return

    if (e.pointerType === 'touch' && e.isPrimary) {
      // This is a single-finger tap — allow move
      // Do NOT block pinch zoom (multi-finger)
    } else if (e.pointerType === 'mouse') {
      // Normal mouse click
    } else {
      return
    }

    const svg = svgRef.current
    if (!svg) return

    const bounds = svg.getBoundingClientRect()

    // For ripple: convert to viewBox coordinates
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse())

    const rippleX = svgPoint.x
    const rippleY = svgPoint.y

    // For player: use pixel coords relative to SVG container
    const playerX = e.clientX - bounds.left
    const playerY = e.clientY - bounds.top

    setClickTarget({ x: playerX, y: playerY })
    setRipples(prev => [...prev, { id: Date.now(), x: rippleX, y: rippleY }])
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    svg.addEventListener('pointerup', handlePointerUp)

    return () => {
      svg.removeEventListener('pointerup', handlePointerUp)
    }
  }, [svgRef, disabled])

  return null
}
