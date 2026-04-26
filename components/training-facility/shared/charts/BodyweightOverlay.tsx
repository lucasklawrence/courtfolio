'use client'

import { useEffect, useId, useState, type JSX, type ReactNode } from 'react'
import { scaleLinear, scaleTime } from 'd3-scale'
import rough from 'roughjs'
import type { Benchmark } from '@/types/movement'
import { Axis, type AxisTick } from './axes'
import { chartPalette } from './palette'
import { extent } from './rough-svg'
import { resolveMargin, type ChartMargin } from './types'

/**
 * Drop-in wrapper that overlays bodyweight as a secondary right-side axis on
 * any time-series chart. Renders the primary chart child and an absolutely-
 * positioned SVG layer on top, plus a small toggle to hide/show the overlay.
 *
 * The wrapper does not size or scale the primary chart — caller must pass the
 * same `width`, `height`, `margin`, and date domain as the chart child so the
 * x-axes line up. PRD §4 + §7.8.
 */
export interface BodyweightOverlayProps {
  /** Benchmark history. Entries without `bodyweight_lbs` and any with `is_complete === false` are skipped. */
  benchmarks: Benchmark[]
  /**
   * Date domain shared with the primary chart. The overlay's x-scale matches
   * this exactly — caller is responsible for passing the same span the chart
   * child computes from its own data.
   */
  dateExtent: [Date, Date]
  /** Total width in px — must match the primary chart. */
  width: number
  /** Total height in px — must match the primary chart. */
  height: number
  /** Chart margin — must match the primary chart so axes align. */
  margin?: Partial<ChartMargin>
  /** Initial toggle state. Defaults to `true` (overlay visible). Ignored when `enabled` is provided. */
  defaultEnabled?: boolean
  /** Controlled toggle state. When provided, `defaultEnabled` is ignored and the parent owns visibility. */
  enabled?: boolean
  /** Fires when the user toggles. Required reading when `enabled` is controlled. */
  onEnabledChange?: (next: boolean) => void
  /** Stroke color for the bodyweight line + dots. Defaults to a soft ink so it reads as secondary. */
  stroke?: string
  /** Override sketchiness — 0 = clean, 2+ = very wobbly. */
  roughness?: number
  /** Stable seed so re-renders don't re-jitter. */
  seed?: number
  /** Font for tick labels. Defaults to `inherit`. */
  fontFamily?: string
  /** Stroke for axis spines, ticks, and tick labels. */
  axisColor?: string
  /** Right-side axis label. Defaults to `Bodyweight (lbs)`. */
  axisLabel?: string
  /** Toggle button label. Defaults to `Bodyweight`. */
  toggleLabel?: string
  /** Number of ticks on the secondary y-axis. Defaults to 4. */
  yTickCount?: number
  /** Tick label formatter. Defaults to integer pounds. */
  yTickFormat?: (value: number) => string
  /** Optional class on the wrapping `<div>`. */
  className?: string
  /**
   * Accessible name for the bodyweight overlay layer (the SVG, not the child
   * chart). Without this, screen readers announce it as an unnamed graphic.
   */
  ariaLabel?: string
  /** The primary chart to overlay. Should be sized to `width × height` with the same `margin` and date domain. */
  children: ReactNode
}

interface BodyweightPoint {
  date: Date
  bw: number
}

/**
 * Wraps a time-series chart child with a secondary right-side bodyweight
 * axis and a toggle. See {@link BodyweightOverlayProps} for prop semantics.
 *
 * - **Toggle:** uncontrolled by default (seeded with `defaultEnabled`); pass
 *   `enabled` + `onEnabledChange` to lift state into a parent.
 * - **Hydration:** the rough.js overlay layer mounts only after the first
 *   client-side effect. The shared rough.js generator is non-deterministic
 *   across SSR vs client renders when other server-rendered charts on the
 *   page have already advanced its internal state, so deferring sidesteps
 *   "didn't match the client properties" hydration errors on `<path>`
 *   elements. The toggle button still SSRs immediately.
 * - **Margin contract:** caller must pass the same `margin` to both the
 *   wrapper and the chart child so the x-axes line up — the wrapper does
 *   not size or scale the child.
 */
export function BodyweightOverlay({
  benchmarks,
  dateExtent,
  width,
  height,
  margin,
  defaultEnabled = true,
  enabled,
  onEnabledChange,
  stroke = chartPalette.inkSoft,
  roughness = 1.4,
  seed = 7,
  fontFamily = 'inherit',
  axisColor = chartPalette.inkSoft,
  axisLabel = 'Bodyweight (lbs)',
  toggleLabel = 'Bodyweight',
  yTickCount = 4,
  yTickFormat = (v) => `${Math.round(v)}`,
  className,
  ariaLabel = 'Bodyweight overlay',
  children,
}: BodyweightOverlayProps): JSX.Element {
  const [internalEnabled, setInternalEnabled] = useState(defaultEnabled)
  const isControlled = enabled !== undefined
  const isOn = isControlled ? enabled : internalEnabled
  const toggleId = useId()

  // Defer the overlay layer to post-hydration — see the function JSDoc for the
  // SSR/client rough.js generator divergence this avoids.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  const handleToggle = (): void => {
    const next = !isOn
    if (!isControlled) setInternalEnabled(next)
    onEnabledChange?.(next)
  }

  // Clamp to the active chart window so out-of-range points don't drive the
  // y-scale (would compress the visible series) or render outside the plot.
  // Inclusive on both ends — caller's `dateExtent` is the visible domain.
  const fromMs = dateExtent[0].getTime()
  const toMs = dateExtent[1].getTime()
  const points: BodyweightPoint[] = benchmarks
    .filter((b): b is Benchmark & { bodyweight_lbs: number } =>
      typeof b.bodyweight_lbs === 'number' && b.is_complete !== false,
    )
    .map((b) => ({ date: new Date(b.date), bw: b.bodyweight_lbs }))
    .filter((p) => {
      const t = p.date.getTime()
      return t >= fromMs && t <= toMs
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const m = resolveMargin(margin)
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom

  const showLayer = hydrated && isOn && points.length > 0

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width,
        height,
      }}
    >
      {children}
      {showLayer && (
        <BodyweightLayer
          points={points}
          dateExtent={dateExtent}
          width={width}
          height={height}
          innerW={innerW}
          innerH={innerH}
          marginLeft={m.left}
          marginTop={m.top}
          stroke={stroke}
          roughness={roughness}
          seed={seed}
          fontFamily={fontFamily}
          axisColor={axisColor}
          axisLabel={axisLabel}
          yTickCount={yTickCount}
          yTickFormat={yTickFormat}
          ariaLabel={ariaLabel}
        />
      )}
      <button
        type="button"
        id={toggleId}
        onClick={handleToggle}
        aria-pressed={isOn}
        aria-label={`Toggle ${toggleLabel} overlay`}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          fontFamily,
          fontSize: 12,
          lineHeight: 1,
          color: chartPalette.inkBlack,
          background: isOn ? chartPalette.courtLineCream : 'transparent',
          border: `1px solid ${isOn ? chartPalette.inkSoft : chartPalette.hardwoodTan}`,
          borderRadius: 999,
          cursor: 'pointer',
          opacity: points.length === 0 ? 0.5 : 1,
        }}
        disabled={points.length === 0}
        title={
          points.length === 0
            ? 'No bodyweight entries in the selected range'
            : isOn
              ? `Hide ${toggleLabel.toLowerCase()} overlay`
              : `Show ${toggleLabel.toLowerCase()} overlay`
        }
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 999,
            background: isOn ? stroke : 'transparent',
            border: `1px solid ${stroke}`,
          }}
        />
        {toggleLabel}
      </button>
    </div>
  )
}

interface BodyweightLayerProps {
  points: BodyweightPoint[]
  dateExtent: [Date, Date]
  width: number
  height: number
  innerW: number
  innerH: number
  marginLeft: number
  marginTop: number
  stroke: string
  roughness: number
  seed: number
  fontFamily: string
  axisColor: string
  axisLabel: string
  yTickCount: number
  yTickFormat: (value: number) => string
  ariaLabel: string
}

/**
 * Internal rendering layer — split out so the parent stays declarative and the
 * toggle JSX doesn't have to thread a dozen scale variables. Only mounted when
 * the overlay is enabled and there's at least one bodyweight point.
 */
function BodyweightLayer({
  points,
  dateExtent,
  width,
  height,
  innerW,
  innerH,
  marginLeft,
  marginTop,
  stroke,
  roughness,
  seed,
  fontFamily,
  axisColor,
  axisLabel,
  yTickCount,
  yTickFormat,
  ariaLabel,
}: BodyweightLayerProps): JSX.Element {
  const xScale = scaleTime().domain(dateExtent).range([0, innerW])

  const bwValues = points.map((p) => p.bw)
  const [yMin, yMax] = extent(bwValues)
  const yPad = (yMax - yMin) * 0.15 || 1
  const yScale = scaleLinear()
    .domain([yMin - yPad, yMax + yPad])
    .nice()
    .range([innerH, 0])

  const yTicks: AxisTick[] = yScale.ticks(yTickCount).map((tick) => ({
    value: yTickFormat(tick),
    offset: yScale(tick),
  }))

  const linePoints: [number, number][] = points.map((p) => [xScale(p.date), yScale(p.bw)])

  // Fresh generator (not the shared singleton) — see the BodyweightOverlay
  // hydration comment above. Cost is one allocation per render; output is
  // deterministic given the seed.
  const gen = rough.generator()
  const linePath = gen.linearPath(linePoints, {
    stroke,
    strokeWidth: 1.5,
    roughness,
    seed,
  })

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <title>{ariaLabel}</title>
      <g transform={`translate(${marginLeft},${marginTop})`}>
        <Axis
          orientation="right"
          position={innerW}
          start={0}
          end={innerH}
          ticks={yTicks}
          label={axisLabel}
          color={axisColor}
          fontFamily={fontFamily}
          roughness={roughness}
          seed={seed + 200}
        />
        {gen.toPaths(linePath).map((p, i) => (
          <path
            key={`bw-line-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 3"
          />
        ))}
        {linePoints.map(([px, py], i) => {
          const dot = gen.circle(px, py, 7, {
            fill: stroke,
            fillStyle: 'solid',
            stroke,
            strokeWidth: 1,
            roughness: roughness * 0.6,
            seed: seed + 300 + i,
          })
          return gen.toPaths(dot).map((p, j) => (
            <path
              key={`bw-dot-${i}-${j}`}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              fill={p.fill ?? 'none'}
            />
          ))
        })}
      </g>
    </svg>
  )
}
