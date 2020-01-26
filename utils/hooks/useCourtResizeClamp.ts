import { useEffect } from 'react'
import { getScaledCourtBounds, clampToCourt } from '@/utils/movements'

/**
 * Keeps player clamped inside court on resize and orientation change.
 *
 * @param svgRef - ref to your court SVG element
 * @param x - motion value for player X position
 * @param y - motion value for player Y position
 * @param playerWidth - width of player sprite in px
 * @param playerHeight - height of player sprite in px
 */
export function useCourtResizeClamp(
  svgRef: React.RefObject<SVGSVGElement | null>,
  x: any, // motionValue
  y: any, // motionValue
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
