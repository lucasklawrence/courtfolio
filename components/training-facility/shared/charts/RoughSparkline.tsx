import type { JSX } from 'react'
import { chartPalette } from './palette'
import { drawableToPaths, extent, getGenerator } from './rough-svg'

/**
 * A bare, axis-less mini trend line — a hand-drawn sparkline. Sized to a small
 * fixed box and meant to be stacked in a small-multiples summary (the OTF
 * machine cards, #266), where the label and value range live in the
 * surrounding layout, not the chart.
 */
export interface RoughSparklineProps {
  /**
   * Ordered points. `x` positions along the width, `y` along the height. Pass a
   * shared {@link RoughSparklineProps.xDomain} across sibling sparklines so
   * their points line up by x (e.g. by date) down the column.
   */
  points: Array<{ x: number; y: number }>
  /** Box width in px. */
  width: number
  /** Box height in px. */
  height: number
  /** X domain for cross-sparkline alignment. Defaults to the points' own x-extent. */
  xDomain?: [number, number]
  /** Y domain. Defaults to the points' own y-extent, so each sparkline scales to its own range. */
  yDomain?: [number, number]
  /** Line + last-dot color. Defaults to rim-orange. */
  stroke?: string
  strokeWidth?: number
  /** Override sketchiness. Kept low by default so small lines don't read as noise. */
  roughness?: number
  /** Stable seed so re-renders don't re-jitter. */
  seed?: number
  /** Draw a filled dot on the most recent point. Defaults to true. */
  showLastDot?: boolean
  /** Inner padding so the line and dot don't clip the box edges. */
  padding?: number
  className?: string
  /** Accessible name — without it the sparkline announces as an unnamed graphic. */
  ariaLabel?: string
}

/**
 * Render {@link RoughSparklineProps.points} as a small rough.js line with a dot
 * on the latest point. A single point draws just the dot; an empty `points`
 * draws an empty (labelled) box.
 */
export function RoughSparkline({
  points,
  width,
  height,
  xDomain,
  yDomain,
  stroke = chartPalette.rimOrange,
  strokeWidth = 1.5,
  roughness = 0.9,
  seed = 1,
  showLastDot = true,
  padding = 3,
  className,
  ariaLabel,
}: RoughSparklineProps): JSX.Element {
  const svgProps = {
    width,
    height,
    className,
    role: 'img' as const,
    'aria-label': ariaLabel,
  }

  if (points.length === 0) {
    return (
      <svg {...svgProps}>
        {ariaLabel && <title>{ariaLabel}</title>}
      </svg>
    )
  }

  const [x0, x1] = xDomain ?? extent(points.map(p => p.x))
  const [y0, y1] = yDomain ?? extent(points.map(p => p.y))
  const spanX = x1 - x0
  const spanY = y1 - y0
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  // Flat domain (single point or all-equal) → center on that axis rather than
  // dividing by zero.
  const sx = (x: number): number => (spanX === 0 ? width / 2 : padding + ((x - x0) / spanX) * innerW)
  const sy = (y: number): number =>
    spanY === 0 ? height / 2 : height - padding - ((y - y0) / spanY) * innerH

  const mapped: [number, number][] = points.map(p => [sx(p.x), sy(p.y)])
  const gen = getGenerator()
  const linePath = mapped.length >= 2 ? gen.linearPath(mapped, { stroke, strokeWidth, roughness, seed }) : null
  const last = mapped[mapped.length - 1]
  const dot = showLastDot ? gen.circle(last[0], last[1], 5, {
    fill: stroke,
    fillStyle: 'solid',
    stroke,
    strokeWidth: 1,
    roughness: roughness * 0.6,
    seed: seed + 7,
  }) : null

  return (
    <svg {...svgProps}>
      {ariaLabel && <title>{ariaLabel}</title>}
      {linePath &&
        drawableToPaths(linePath).map((p, i) => (
          <path
            key={`spark-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      {dot &&
        drawableToPaths(dot).map((p, i) => (
          <path key={`dot-${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill ?? 'none'} />
        ))}
    </svg>
  )
}
