import { disableInstantTransitions } from 'framer-motion'
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
  const handleEvent = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return

    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('.ui-ignore')
    )
      return

    e.preventDefault()

    const svg = svgRef.current
    if (!svg) return

    const bounds = svg.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

    // For ripple: convert to viewBox coordinates
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse())

    const rippleX = svgPoint.x
    const rippleY = svgPoint.y

    // For player: use pixel coords relative to SVG container
    const playerX = clientX - bounds.left
    const playerY = clientY - bounds.top

    setClickTarget({ x: playerX, y: playerY }) // player uses pixel space
    setRipples(prev => [...prev, { id: Date.now(), x: rippleX, y: rippleY }])
  }

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    svg.addEventListener('click', handleEvent as any)
    svg.addEventListener('touchstart', handleEvent as any)

    return () => {
      svg.removeEventListener('click', handleEvent as any)
      svg.removeEventListener('touchstart', handleEvent as any)
    }
  }, [svgRef, disabled])

  return null
}
