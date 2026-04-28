import type { JSX, ReactNode } from 'react'

import {
  drawableToPaths,
  getGenerator,
} from '@/components/training-facility/shared/charts/rough-svg'

/**
 * Subset of roughjs `Options` we expose through these wrappers. Keeping the
 * surface small avoids drift between scenes and keeps stroke style consistent
 * across the Training Facility art.
 */
export type RoughOptions = {
  /** Outline color. */
  stroke?: string
  /** Outline thickness. */
  strokeWidth?: number
  /** Fill color. Omit for unfilled outlines. */
  fill?: string
  /**
   * roughjs fill mode — 'solid' is closest to a marker fill, 'hachure' looks
   * like a sketched scribble, 'cross-hatch' / 'zigzag' get stylized.
   */
  fillStyle?: 'solid' | 'hachure' | 'cross-hatch' | 'zigzag' | 'dots' | 'dashed'
  /** Stroke thickness inside hachure fills. */
  fillWeight?: number
  /** Spacing between hachure lines. */
  hachureGap?: number
  /** Hachure line angle, in degrees. */
  hachureAngle?: number
  /**
   * 0 = perfectly straight; 1 = mildly hand-drawn; 2 = clearly sketchy.
   * Defaults to 1.4 to match the chart palette.
   */
  roughness?: number
  /**
   * Bowing — how much straight lines curve. 0 = none, 1 = subtle, 2+ = wobbly.
   * Defaults to 1.
   */
  bowing?: number
  /**
   * Deterministic seed so SSR + client renders match exactly. Pass a stable
   * integer per shape; reusing seeds across shapes is fine.
   */
  seed?: number
  /** Round line caps for marker-like ends. Defaults to 'round'. */
  strokeLinecap?: 'butt' | 'round' | 'square'
  /** Round joins for marker-like corners. Defaults to 'round'. */
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  /**
   * Stroke opacity passed through to the rendered `<path>` elements. Lets
   * scenes fade rough strokes (e.g. background motion lines) without baking
   * the alpha into the stroke color.
   */
  strokeOpacity?: number
  /**
   * Fill opacity passed through to the rendered `<path>` elements when the
   * shape has a fill. Useful for translucent fills layered over a base.
   */
  fillOpacity?: number
}

const DEFAULT_OPTIONS: Required<Pick<RoughOptions, 'roughness' | 'bowing' | 'strokeLinecap' | 'strokeLinejoin'>> = {
  roughness: 1.4,
  bowing: 1,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function renderPaths(
  paths: ReturnType<typeof drawableToPaths>,
  cap: NonNullable<RoughOptions['strokeLinecap']>,
  join: NonNullable<RoughOptions['strokeLinejoin']>,
  strokeOpacity: number | undefined,
  fillOpacity: number | undefined,
  keyPrefix: string
): JSX.Element[] {
  return paths.map((p, i) => (
    <path
      key={`${keyPrefix}-${i}`}
      d={p.d}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      fill={p.fill ?? 'none'}
      strokeLinecap={cap}
      strokeLinejoin={join}
      strokeOpacity={strokeOpacity}
      fillOpacity={fillOpacity}
    />
  ))
}

function buildRoughOptions(opts: RoughOptions) {
  const {
    strokeLinecap: _cap,
    strokeLinejoin: _join,
    strokeOpacity: _so,
    fillOpacity: _fo,
    ...rest
  } = opts
  return {
    roughness: opts.roughness ?? DEFAULT_OPTIONS.roughness,
    bowing: opts.bowing ?? DEFAULT_OPTIONS.bowing,
    ...rest,
  }
}

/**
 * Props for {@link RoughRect}.
 */
export type RoughRectProps = RoughOptions & {
  /** Top-left x. */
  x: number
  /** Top-left y. */
  y: number
  /** Width. */
  width: number
  /** Height. */
  height: number
}

/**
 * Hand-drawn rectangle rendered via roughjs and converted to plain SVG paths
 * server-side, so the same artwork renders during SSR and hydration.
 */
export function RoughRect({ x, y, width, height, ...opts }: RoughRectProps): JSX.Element {
  const drawable = getGenerator().rectangle(x, y, width, height, buildRoughOptions(opts))
  const cap = opts.strokeLinecap ?? DEFAULT_OPTIONS.strokeLinecap
  const join = opts.strokeLinejoin ?? DEFAULT_OPTIONS.strokeLinejoin
  return (
    <g>
      {renderPaths(
        drawableToPaths(drawable),
        cap,
        join,
        opts.strokeOpacity,
        opts.fillOpacity,
        'rect'
      )}
    </g>
  )
}

/**
 * Props for {@link RoughCircle}.
 */
export type RoughCircleProps = RoughOptions & {
  /** Center x. */
  cx: number
  /** Center y. */
  cy: number
  /** Radius. */
  r: number
}

/**
 * Hand-drawn circle. Diameter is `2 * r` to match the SVG `<circle>` API
 * even though roughjs's underlying generator takes diameter directly.
 */
export function RoughCircle({ cx, cy, r, ...opts }: RoughCircleProps): JSX.Element {
  const drawable = getGenerator().circle(cx, cy, r * 2, buildRoughOptions(opts))
  const cap = opts.strokeLinecap ?? DEFAULT_OPTIONS.strokeLinecap
  const join = opts.strokeLinejoin ?? DEFAULT_OPTIONS.strokeLinejoin
  return (
    <g>
      {renderPaths(
        drawableToPaths(drawable),
        cap,
        join,
        opts.strokeOpacity,
        opts.fillOpacity,
        'circle'
      )}
    </g>
  )
}

/**
 * Props for {@link RoughEllipse}.
 */
export type RoughEllipseProps = RoughOptions & {
  /** Center x. */
  cx: number
  /** Center y. */
  cy: number
  /** Horizontal diameter (`2 * rx`). */
  width: number
  /** Vertical diameter (`2 * ry`). */
  height: number
}

/**
 * Hand-drawn ellipse. Used for shadow puddles under equipment and for
 * stylized circular details that aren't perfectly round.
 */
export function RoughEllipse({ cx, cy, width, height, ...opts }: RoughEllipseProps): JSX.Element {
  const drawable = getGenerator().ellipse(cx, cy, width, height, buildRoughOptions(opts))
  const cap = opts.strokeLinecap ?? DEFAULT_OPTIONS.strokeLinecap
  const join = opts.strokeLinejoin ?? DEFAULT_OPTIONS.strokeLinejoin
  return (
    <g>
      {renderPaths(
        drawableToPaths(drawable),
        cap,
        join,
        opts.strokeOpacity,
        opts.fillOpacity,
        'ellipse'
      )}
    </g>
  )
}

/**
 * Props for {@link RoughLine}.
 */
export type RoughLineProps = RoughOptions & {
  /** Start x. */
  x1: number
  /** Start y. */
  y1: number
  /** End x. */
  x2: number
  /** End y. */
  y2: number
}

/**
 * Hand-drawn line segment. Marker-style strokes for handrails, run-lines, and
 * any straight edge that should look hand-drawn.
 */
export function RoughLineShape({ x1, y1, x2, y2, ...opts }: RoughLineProps): JSX.Element {
  const drawable = getGenerator().line(x1, y1, x2, y2, buildRoughOptions(opts))
  const cap = opts.strokeLinecap ?? DEFAULT_OPTIONS.strokeLinecap
  const join = opts.strokeLinejoin ?? DEFAULT_OPTIONS.strokeLinejoin
  return (
    <g>
      {renderPaths(
        drawableToPaths(drawable),
        cap,
        join,
        opts.strokeOpacity,
        opts.fillOpacity,
        'line'
      )}
    </g>
  )
}

/**
 * Props for {@link RoughPath}.
 */
export type RoughPathProps = RoughOptions & {
  /** SVG `d` attribute — same syntax as `<path d="...">`. */
  d: string
}

/**
 * Hand-drawn arbitrary path. Use for curves, custom outlines, and the
 * roughjs equivalent of a `<path>` element.
 */
export function RoughPath({ d, ...opts }: RoughPathProps): JSX.Element {
  const drawable = getGenerator().path(d, buildRoughOptions(opts))
  const cap = opts.strokeLinecap ?? DEFAULT_OPTIONS.strokeLinecap
  const join = opts.strokeLinejoin ?? DEFAULT_OPTIONS.strokeLinejoin
  return (
    <g>
      {renderPaths(
        drawableToPaths(drawable),
        cap,
        join,
        opts.strokeOpacity,
        opts.fillOpacity,
        'path'
      )}
    </g>
  )
}

/**
 * Props for {@link RoughPolygon}.
 */
export type RoughPolygonProps = RoughOptions & {
  /** Vertices, given as `[x, y]` pairs. */
  points: Array<[number, number]>
}

/**
 * Hand-drawn closed polygon. Used for cone bodies, vane tips, and any
 * triangle / parallelogram shape.
 */
export function RoughPolygon({ points, ...opts }: RoughPolygonProps): JSX.Element {
  const drawable = getGenerator().polygon(points, buildRoughOptions(opts))
  const cap = opts.strokeLinecap ?? DEFAULT_OPTIONS.strokeLinecap
  const join = opts.strokeLinejoin ?? DEFAULT_OPTIONS.strokeLinejoin
  return (
    <g>
      {renderPaths(
        drawableToPaths(drawable),
        cap,
        join,
        opts.strokeOpacity,
        opts.fillOpacity,
        'poly'
      )}
    </g>
  )
}

/**
 * Props for {@link RoughGroup}.
 */
type RoughGroupProps = {
  /** Optional transform attribute applied to the group. */
  transform?: string
  /** Group children. */
  children: ReactNode
}

/**
 * Convenience wrapper for grouping rough shapes with a shared transform —
 * keeps asset components readable when they need to translate / rotate a
 * cluster of strokes together.
 *
 * @param props.transform - SVG transform attribute (e.g. `"translate(100, 50)"`).
 * @param props.children - Child elements rendered inside the group.
 */
export function RoughGroup({ transform, children }: RoughGroupProps): JSX.Element {
  return <g transform={transform}>{children}</g>
}
