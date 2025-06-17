/** Constants based on your SVG viewBox and actual playable zone */
const COURT_X = 270
const COURT_Y = 60
const COURT_WIDTH = 1040
const COURT_HEIGHT = 835

export interface ScaledCourtBounds {
  pxCourtX: number
  pxCourtY: number
  pxCourtWidth: number
  pxCourtHeight: number
  scaleX: number
  scaleY: number
}

/**
 * Given an SVG element, returns the court bounds scaled into screen space.
 */
export function getScaledCourtBounds(svg: SVGSVGElement): ScaledCourtBounds {
  const bounds = svg.getBoundingClientRect()
  const scaleX = bounds.width / 1600
  const scaleY = bounds.height / 1000

  return {
    pxCourtX: COURT_X * scaleX,
    pxCourtY: COURT_Y * scaleY,
    pxCourtWidth: COURT_WIDTH * scaleX,
    pxCourtHeight: COURT_HEIGHT * scaleY,
    scaleX,
    scaleY,
  }
}

/**
 * Clamps a screen-space position to the playable area of the court.
 *
 * @param x - raw screen-space x coordinate
 * @param y - raw screen-space y coordinate
 * @param bounds - scaled bounds from getScaledCourtBounds()
 * @param playerWidth - width of the player sprite (in screen pixels)
 * @param playerHeight - height of the player sprite (in screen pixels)
 */
export function clampToCourt(
  x: number,
  y: number,
  bounds: ScaledCourtBounds,
  playerWidth: number,
  playerHeight: number
): { x: number; y: number } {
  const maxX = bounds.pxCourtX + bounds.pxCourtWidth - playerWidth
  const maxY = bounds.pxCourtY + bounds.pxCourtHeight - playerHeight

  return {
    x: Math.max(bounds.pxCourtX, Math.min(x, maxX)),
    y: Math.max(bounds.pxCourtY, Math.min(y, maxY)),
  }
}
