'use client'

import { type JSX } from 'react'

import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import {
  drawableToPaths,
  getGenerator,
} from '@/components/training-facility/shared/charts/rough-svg'
import {
  pickMetricBaseline,
  pickMetricLatest,
} from '@/components/training-facility/shared/scoreboard-utils'
import { BENCHMARKS, type MetricKey } from '@/constants/benchmarks'
import type { Benchmark } from '@/types/movement'

/**
 * Order in which axes wrap clockwise around the radar starting from 12
 * o'clock (top). Mirrors PRD §9.7's listing — 5-10-5 → Vertical → 10y
 * sprint → Bodyweight — and is `as const` so the four-axis assumption is
 * encoded in the type, not just the docstring.
 */
export const RADAR_AXIS_ORDER: readonly MetricKey[] = [
  'shuttle_5_10_5_s',
  'vertical_in',
  'sprint_10y_s',
  'bodyweight_lbs',
] as const

/** Radius factors for the concentric reference rings (1.0 = the rim). */
const RING_FACTORS: readonly number[] = [0.25, 0.5, 0.75, 1.0]

/**
 * Map a metric value to `[0, 1]` where `1` is the elite end of
 * `BENCHMARKS[key].targetRange`. Direction-aware — for `'lower'` metrics
 * (5-10-5, 10y sprint, bodyweight) a smaller raw value yields a larger
 * score; for `'higher'` metrics (vertical) a bigger raw value does.
 *
 * Clamps to `[0, 1]` at both ends: an off-day value below the elite floor
 * doesn't pierce the center, and an exceptional value above the rim
 * doesn't blow past it. Returns `null` when `value` is missing /
 * non-finite, so callers can render axes with no data distinct from axes
 * scored at zero.
 *
 * @param key   Which Tier-1 metric the value belongs to.
 * @param value Raw metric reading, or `undefined` if missing. NaN is treated as missing.
 */
export function normalizeMetric(
  key: MetricKey,
  value: number | undefined,
): number | null {
  if (value === undefined || !Number.isFinite(value)) return null
  const spec = BENCHMARKS[key]
  const [a, b] = spec.targetRange
  const span = b - a
  if (span === 0) return null
  const raw =
    spec.direction === 'higher' ? (value - a) / span : (b - value) / span
  if (raw < 0) return 0
  if (raw > 1) return 1
  return raw
}

/** One projected vertex of the radar polygon. */
export interface RadarVertex {
  /** Which axis this vertex sits on. */
  metric: MetricKey
  /** Short-form axis label rendered at the rim (e.g. `"VERT"`, `"5-10-5"`). */
  shortLabel: string
  /** Normalized score in `[0, 1]`, or `null` if no qualifying entry has a value for this axis. */
  score: number | null
  /** Raw metric reading the score was derived from, kept for tooltips / aria text. */
  value: number | undefined
}

/** Four-vertex radar shape — one vertex per axis in {@link RADAR_AXIS_ORDER}. */
export interface RadarShape {
  /** Vertices in {@link RADAR_AXIS_ORDER}, always length 4. */
  vertices: readonly RadarVertex[]
}

/** Pick function used to resolve a metric's raw value from the benchmark history. */
type MetricPicker = (
  entries: readonly Benchmark[],
  key: MetricKey,
) => number | undefined

/**
 * Build a four-vertex radar shape from a benchmark history using a
 * caller-supplied pick function (typically `pickMetricLatest` or
 * `pickMetricBaseline`). Per-axis baselining matches the scoreboard's
 * behaviour — a partial entry contributes to the axes it covers.
 *
 * @param entries Full benchmark history; order does not matter.
 * @param pick    Per-metric value resolver — see `scoreboard-utils.ts`.
 */
export function buildRadarShape(
  entries: readonly Benchmark[],
  pick: MetricPicker,
): RadarShape {
  const vertices: RadarVertex[] = RADAR_AXIS_ORDER.map((metric) => {
    const value = pick(entries, metric)
    return {
      metric,
      shortLabel: BENCHMARKS[metric].shortLabel,
      score: normalizeMetric(metric, value),
      value,
    }
  })
  return { vertices }
}

/** Whether a shape has a score on every axis — required for a closed polygon. */
export function isShapeComplete(shape: RadarShape): boolean {
  return shape.vertices.every((v) => v.score !== null)
}

/** Whether two shapes have the same score on every axis (used to skip drawing the earliest outline when it overlaps the latest exactly). */
export function shapesEqual(a: RadarShape, b: RadarShape): boolean {
  return RADAR_AXIS_ORDER.every(
    (_, i) => a.vertices[i].score === b.vertices[i].score,
  )
}

/** Geometry-only props extracted so the projection math is independently testable. */
interface RadarGeometry {
  /** SVG viewBox center x. */
  cx: number
  /** SVG viewBox center y. */
  cy: number
  /** Pixel radius corresponding to a normalized score of 1.0. */
  rim: number
}

/**
 * Project a single vertex onto SVG coordinates.
 *
 * Axis indices increase clockwise starting at 12 o'clock — index 0 is up,
 * index 1 is right, index 2 is down, index 3 is left. SVG y grows
 * downward, so the top vertex uses `-Math.PI / 2` and `sin` follows
 * naturally.
 *
 * @param axisIndex Position in {@link RADAR_AXIS_ORDER}.
 * @param score     Normalized score in `[0, 1]`. Caller is responsible for clamping.
 * @param geo       Center + rim radius.
 */
export function projectVertex(
  axisIndex: number,
  score: number,
  geo: RadarGeometry,
): [number, number] {
  const angle = -Math.PI / 2 + axisIndex * (Math.PI / 2)
  const r = score * geo.rim
  return [geo.cx + r * Math.cos(angle), geo.cy + r * Math.sin(angle)]
}

/** Props for {@link CombineRadar}. */
export interface CombineRadarProps {
  /**
   * Benchmark history shared with the rest of the Combine page (typically
   * fed from `CombineDataIsland`). `undefined` while the initial fetch is
   * in flight; an empty array means no entries are logged.
   */
  entries: Benchmark[] | undefined
}

const VIEWBOX = 400
const CENTER = VIEWBOX / 2
const RIM = 140
const LABEL_OFFSET = 22
const GEO: RadarGeometry = { cx: CENTER, cy: CENTER, rim: RIM }

/**
 * Radar visualization (PRD §9.7) — the four Tier-1 Combine axes (5-10-5,
 * Vertical, 10y Sprint, Bodyweight) projected onto a hand-drawn polygon
 * so the shape grows outward as benchmarks improve.
 *
 * Latest entry: filled rim-orange polygon at 30% opacity. Earliest:
 * dashed cream outline behind it. The optional scrubber timeline from
 * the PRD is intentionally deferred.
 *
 * Returns `null` while the initial fetch is in flight (matches
 * `CombineTradingCard`'s placeholder behaviour) and when the history
 * has no entry that covers all four axes — the scoreboard already
 * surfaces the empty state, so duplicating it here would be noise.
 *
 * @param props.entries Shared benchmark history. `undefined` ⇒ render nothing; `[]` ⇒ render nothing; populated ⇒ render the radar with per-axis latest + earliest shapes.
 */
export function CombineRadar({
  entries,
}: CombineRadarProps): JSX.Element | null {
  if (!entries || entries.length === 0) return null

  const latest = buildRadarShape(entries, pickMetricLatest)
  const earliest = buildRadarShape(entries, pickMetricBaseline)
  if (!isShapeComplete(latest)) return null

  const showEarliest = isShapeComplete(earliest) && !shapesEqual(latest, earliest)
  const gen = getGenerator()

  const ringPaths = RING_FACTORS.flatMap((factor, ringIdx) => {
    const ringPoints: [number, number][] = RADAR_AXIS_ORDER.map((_, i) =>
      projectVertex(i, factor, GEO),
    )
    const ring = gen.polygon(ringPoints, {
      stroke: chartPalette.courtLineCream,
      strokeWidth: factor === 1 ? 1.5 : 0.8,
      roughness: 1.6,
      bowing: 1.2,
      seed: 11 + ringIdx,
      fill: undefined,
    })
    return drawableToPaths(ring).map((p, i) => (
      <path
        key={`ring-${ringIdx}-${i}`}
        d={p.d}
        stroke={p.stroke}
        strokeWidth={p.strokeWidth}
        fill="none"
        opacity={factor === 1 ? 0.55 : 0.22}
      />
    ))
  })

  const axisPaths = RADAR_AXIS_ORDER.map((_, i) => {
    const [x, y] = projectVertex(i, 1, GEO)
    const drawable = gen.line(GEO.cx, GEO.cy, x, y, {
      stroke: chartPalette.courtLineCream,
      strokeWidth: 0.8,
      roughness: 1.2,
      seed: 31 + i,
    })
    return drawableToPaths(drawable).map((p, j) => (
      <path
        key={`axis-${i}-${j}`}
        d={p.d}
        stroke={p.stroke}
        strokeWidth={p.strokeWidth}
        fill="none"
        opacity={0.35}
      />
    ))
  })

  const earliestPaths = showEarliest
    ? (() => {
        const points: [number, number][] = earliest.vertices.map((v, i) =>
          projectVertex(i, v.score ?? 0, GEO),
        )
        const drawable = gen.polygon(points, {
          stroke: chartPalette.courtLineCream,
          strokeWidth: 1.6,
          roughness: 1.4,
          bowing: 1,
          seed: 51,
          fill: undefined,
        })
        // `strokeDasharray` lives on the `<path>` element, not in the
        // rough.js drawable — `drawableToPaths` only carries
        // `d`/`stroke`/`strokeWidth`/`fill` (see `rough-svg.ts`), so a
        // `strokeLineDash` rough option would be silently dropped.
        return drawableToPaths(drawable).map((p, i) => (
          <path
            key={`earliest-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            strokeDasharray="6 4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        ))
      })()
    : null

  const latestPoints: [number, number][] = latest.vertices.map((v, i) =>
    projectVertex(i, v.score ?? 0, GEO),
  )
  const latestDrawable = gen.polygon(latestPoints, {
    stroke: chartPalette.rimOrange,
    strokeWidth: 2.2,
    fill: chartPalette.rimOrange,
    fillStyle: 'solid',
    roughness: 1.6,
    bowing: 1.2,
    seed: 71,
  })
  const latestPaths = drawableToPaths(latestDrawable).map((p, i) => (
    <path
      key={`latest-${i}`}
      d={p.d}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      fill={p.fill ?? 'none'}
      fillOpacity={p.fill ? 0.3 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ))

  const labels = latest.vertices.map((v, i) => {
    const [x, y] = projectVertex(i, 1, GEO)
    // Push label outward along the same axis so it doesn't sit on the rim
    // line. `dx`/`dy` from center sign tells us which side to nudge to.
    const dx = x - GEO.cx
    const dy = y - GEO.cy
    const norm = Math.hypot(dx, dy) || 1
    const lx = x + (dx / norm) * LABEL_OFFSET
    const ly = y + (dy / norm) * LABEL_OFFSET
    const anchor: 'start' | 'middle' | 'end' =
      dx > 0.5 ? 'start' : dx < -0.5 ? 'end' : 'middle'
    const baseline: 'auto' | 'middle' | 'hanging' =
      dy > 0.5 ? 'hanging' : dy < -0.5 ? 'auto' : 'middle'
    return (
      <text
        key={`label-${v.metric}`}
        x={lx}
        y={ly}
        textAnchor={anchor}
        dominantBaseline={baseline}
        fontFamily="inherit"
        fontSize={13}
        fontWeight={600}
        fill={chartPalette.courtLineCream}
        opacity={0.85}
      >
        {v.shortLabel}
      </text>
    )
  })

  const ariaSummary = latest.vertices
    .map((v) => {
      const spec = BENCHMARKS[v.metric]
      const formatted =
        typeof v.value === 'number'
          ? `${v.value.toFixed(spec.precision)}${spec.unit}`
          : '—'
      return `${spec.label} ${formatted}`
    })
    .join(', ')

  return (
    <section
      aria-label="Combine radar — latest vs earliest benchmark shape"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-3"
    >
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        role="img"
        aria-label={`Athletic shape: ${ariaSummary}`}
        className="h-auto w-full"
      >
        <title>Combine radar</title>
        {ringPaths}
        {axisPaths}
        {earliestPaths}
        {latestPaths}
        {labels}
      </svg>
      <Legend showEarliest={showEarliest} />
    </section>
  )
}

/** Tiny key explaining what the two polygons represent — only renders the earliest swatch when an earliest shape is drawn. */
function Legend({ showEarliest }: { showEarliest: boolean }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs uppercase tracking-[0.2em] text-[#e8d5be]/80">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-3 w-5 rounded-sm"
          style={{ backgroundColor: chartPalette.rimOrange, opacity: 0.55 }}
        />
        Latest
      </span>
      {showEarliest && (
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-0 w-5 border-t border-dashed"
            style={{ borderColor: chartPalette.courtLineCream }}
          />
          Earliest
        </span>
      )}
    </div>
  )
}
