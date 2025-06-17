import React, { useEffect } from 'react'

type Ripple = { id: number; x: number; y: number }

type CourtInteractionLayerProps = {
  svgRef: React.RefObject<SVGSVGElement | null>
  setClickTarget: (pt: { x: number; y: number }) => void
  setRipples: React.Dispatch<React.SetStateAction<Ripple[]>>
}

export function CourtInteractionLayer({
  svgRef,
  setClickTarget,
  setRipples,
}: CourtInteractionLayerProps) {
  const handleEvent = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()

    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('.ui-ignore')
    ) return

    const svg = svgRef.current
    if (!svg) return

    const bounds = svg.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    const x = clientX - bounds.left
    const y = clientY - bounds.top

    setClickTarget({ x, y })

    const id = Date.now()
    setRipples(prev => [...prev, { id, x, y }])
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id))
    }, 600)
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
  }, [svgRef])

  return null
}
