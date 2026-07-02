import type { JSX } from 'react'
import { scaleLinear, scaleTime, type ScaleLinear, type ScaleTime } from 'd3-scale'
import { Axis, EmptyChart, type AxisTick } from './axes'
import { chartPalette } from './palette'
import { drawableToPaths, extent, getGenerator } from './rough-svg'
import { resolveMargin, type ChartCommonProps } from './types'

/**
 * One line in a {@link RoughMultiLine}. Every series shares the chart's x- and
 * y-scales, so their `x` values must all be the same kind (all `Date` for a
 * time axis, or all `number` for a linear one) and their `y` values must live
 * in the same domain — pre-normalize to a common range (e.g. 0–1) before
 * passing series whose raw units differ.
 */
export interface RoughLineSeries {
  /** Accessible/legend label for this line. */
  label: string
  /** Stroke + dot color. */
  color: string
  /** Ordered points. Empty series are skipped (they contribute no line/dots and don't affect the scales). */
  points: Array<{ x: number | Date; y: number }>
}

/**
 * Multi-series sibling of {@link RoughLine}: several hand-drawn lines sharing
 * one x-axis and one y-axis. Built for normalized overlays (pass `yDomain={[0, 1]}`
 * and pre-scaled series) where metrics of different units are compared by shape
 * on a common axis — the caller owns the legend and any absolute-value labels.
 */
export interface RoughMultiLineProps extends ChartCommonProps {
  /** The lines to draw. All non-empty series must agree on x-kind (Date vs number). */
  series: RoughLineSeries[]
  strokeWidth?: number
  /** Render a rough dot at each point. Defaults to true. */
  showDots?: boolean
  dotRadius?: number
  xLabel?: string
  yLabel?: string
  xTickCount?: number
  yTickCount?: number
  xTickFormat?: (value: number | Date) => string
  yTickFormat?: (value: number) => string
  /**
   * Fixed y-domain, used verbatim (no padding/`nice()`). Pass `[0, 1]` for a
   * normalized overlay so every series maps onto the same 0–100% axis. When
   * omitted, the domain is the padded extent across all series' y-values.
   */
  yDomain?: [number, number]
}

function isDateValue(v: number | Date): v is Date {
  return v instanceof Date
}

/**
 * Draw {@link RoughMultiLineProps.series} as overlaid rough.js lines. Renders
 * the {@link EmptyChart} placeholder when no series has any points.
 */
export function RoughMultiLine({
  series,
  width,
  height,
  margin,
  strokeWidth = 2,
  showDots = true,
  dotRadius = 4,
  roughness = 1.4,
  seed = 1,
  fontFamily = 'inherit',
  axisColor = chartPalette.inkBlack,
  xLabel,
  yLabel,
  xTickCount = 5,
  yTickCount = 5,
  xTickFormat,
  yTickFormat,
  yDomain,
  className,
  ariaLabel,
  ariaLabelledBy,
  emptyMessage,
}: RoughMultiLineProps): JSX.Element {
  const m = resolveMargin(margin)
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom

  const drawnSeries = series.filter((s) => s.points.length > 0)

  if (drawnSeries.length === 0) {
    return (
      <EmptyChart
        width={width}
        height={height}
        message={emptyMessage}
        fontFamily={fontFamily}
        className={className}
        ariaLabel={ariaLabel}
        ariaLabelledBy={ariaLabelledBy}
      />
    )
  }

  const allX = drawnSeries.flatMap((s) => s.points.map((p) => p.x))
  const allY = drawnSeries.flatMap((s) => s.points.map((p) => p.y))
  const usingTime = isDateValue(allX[0])

  // One shared x-scale for every series. The two branches mirror RoughLine's —
  // structurally identical, differing only in the domain input type — so the
  // rest of the function calls `scaleX(value)` without union casts.
  let scaleX: (value: number | Date) => number
  let xTicks: AxisTick[]
  if (usingTime) {
    const [tMin, tMax] = extent((allX as Date[]).map((d) => d.getTime()))
    const timeScale: ScaleTime<number, number> = scaleTime()
      .domain([new Date(tMin), new Date(tMax)])
      .range([0, innerW])
    scaleX = (v) => timeScale(v as Date)
    xTicks = timeScale.ticks(xTickCount).map((tick) => ({
      value: xTickFormat
        ? xTickFormat(tick)
        : tick.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      offset: timeScale(tick),
    }))
  } else {
    const [xMin, xMax] = extent(allX as number[])
    const linearScale: ScaleLinear<number, number> = scaleLinear()
      .domain([xMin, xMax])
      .range([0, innerW])
    scaleX = (v) => linearScale(v as number)
    xTicks = linearScale.ticks(xTickCount).map((tick) => ({
      value: xTickFormat ? xTickFormat(tick) : String(tick),
      offset: linearScale(tick),
    }))
  }

  // Shared y-scale. A caller-supplied `yDomain` is used verbatim (normalized
  // overlays want an exact 0–1, not a `nice()`-widened one); otherwise pad the
  // data extent like RoughLine so points don't hug the frame.
  let yScale: ScaleLinear<number, number>
  if (yDomain) {
    yScale = scaleLinear().domain(yDomain).range([innerH, 0])
  } else {
    const [yMin, yMax] = extent(allY)
    const yPad = (yMax - yMin) * 0.1 || 1
    yScale = scaleLinear()
      .domain([yMin - yPad, yMax + yPad])
      .nice()
      .range([innerH, 0])
  }

  const yTicks: AxisTick[] = yScale.ticks(yTickCount).map((tick) => ({
    value: yTickFormat ? yTickFormat(tick) : String(tick),
    offset: yScale(tick),
  }))

  const gen = getGenerator()

  return (
    <svg
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {ariaLabel && !ariaLabelledBy && <title>{ariaLabel}</title>}
      <g transform={`translate(${m.left},${m.top})`}>
        <Axis
          orientation="bottom"
          position={innerH}
          start={0}
          end={innerW}
          ticks={xTicks}
          label={xLabel}
          color={axisColor}
          fontFamily={fontFamily}
          roughness={roughness}
          seed={seed + 100}
        />
        <Axis
          orientation="left"
          position={0}
          start={0}
          end={innerH}
          ticks={yTicks}
          label={yLabel}
          color={axisColor}
          fontFamily={fontFamily}
          roughness={roughness}
          seed={seed + 200}
        />
        {drawnSeries.map((s, si) => {
          // Distinct per-series seed offset keeps each line's jitter stable and
          // different from its neighbours without re-randomizing on re-render.
          const seriesSeed = seed + si * 1000
          const points: [number, number][] = s.points.map((p) => [scaleX(p.x), yScale(p.y)])
          const linePath = gen.linearPath(points, {
            stroke: s.color,
            strokeWidth,
            roughness,
            seed: seriesSeed,
          })
          return (
            <g key={`series-${si}`}>
              {drawableToPaths(linePath).map((p, i) => (
                <path
                  key={`line-${si}-${i}`}
                  d={p.d}
                  stroke={p.stroke}
                  strokeWidth={p.strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {showDots &&
                points.map(([px, py], i) => {
                  const dot = gen.circle(px, py, dotRadius * 2, {
                    fill: s.color,
                    fillStyle: 'solid',
                    stroke: s.color,
                    strokeWidth: 1,
                    roughness: roughness * 0.6,
                    seed: seriesSeed + 300 + i,
                  })
                  return drawableToPaths(dot).map((p, j) => (
                    <path
                      key={`dot-${si}-${i}-${j}`}
                      d={p.d}
                      stroke={p.stroke}
                      strokeWidth={p.strokeWidth}
                      fill={p.fill ?? 'none'}
                    />
                  ))
                })}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
