/** Constants based on your SVG viewBox and actual playable zone */
const COURT_X = 85
const COURT_Y = 90
const COURT_WIDTH = 1300
const COURT_HEIGHT = 780

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
  const scaleX = bounds.width / 1536
  const scaleY = bounds.height / 1024

  return {
    pxCourtX: COURT_X * scaleX,
    pxCourtY: COURT_Y * scaleY,
    pxCourtWidth: COURT_WIDTH * scaleX,
    pxCourtHeight: COURT_HEIGHT * scaleY,
    scaleX,
    scaleY,
  }
}

export function getScaledFloorBounds(svg: SVGSVGElement): ScaledCourtBounds {
  const rect = svg.getBoundingClientRect()
  const viewBoxWidth = 1536
  const viewBoxHeight = 1024

  const scaleX = rect.width / viewBoxWidth
  const scaleY = rect.height / viewBoxHeight

  const pxCourtX = COURT_X * scaleX
  const pxCourtY = COURT_Y * scaleY
  const pxCourtWidth = COURT_WIDTH * scaleX
  const pxCourtHeight = COURT_HEIGHT * scaleY

  return {
    pxCourtX,
    pxCourtY,
    pxCourtWidth,
    pxCourtHeight,
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
  const halfW = playerWidth / 2
  const halfH = playerHeight / 2

  const minX = bounds.pxCourtX + halfW
  const maxX = bounds.pxCourtX + bounds.pxCourtWidth - halfW

  const minY = bounds.pxCourtY + halfH
  const maxY = bounds.pxCourtY + bounds.pxCourtHeight - halfH

  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  }
}
