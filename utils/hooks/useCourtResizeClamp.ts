import { useEffect } from 'react'
import type { MotionValue } from 'framer-motion'
import { getScaledCourtBounds, clampToCourt } from '@/utils/movements'

export function useCourtResizeClamp(
  svgRef: React.RefObject<SVGSVGElement | null>,
  x: MotionValue<number>,
  y: MotionValue<number>,
  playerWidth: number,
  playerHeight: number
) {
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const updatePosition = () => {
      const bounds = getScaledCourtBounds(svg)
      const { x: clampedX, y: clampedY } = clampToCourt(
        x.get(),
        y.get(),
        bounds,
        playerWidth,
        playerHeight
      )
      x.set(clampedX)
      y.set(clampedY)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('orientationchange', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('orientationchange', updatePosition)
    }
  }, [x, y, svgRef, playerWidth, playerHeight])
}
