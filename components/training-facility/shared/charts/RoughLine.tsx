import type { JSX } from 'react'
import { scaleLinear, scaleTime, type ScaleLinear, type ScaleTime } from 'd3-scale'
import { Axis, EmptyChart, type AxisTick } from './axes'
import { chartPalette } from './palette'
import { drawableToPaths, extent, getGenerator } from './rough-svg'
import { resolveMargin, type ChartCommonProps } from './types'

export interface RoughLineProps<T> extends ChartCommonProps {
  data: T[]
  x: (d: T) => number | Date
  y: (d: T) => number
  /** Line color. Defaults to rim-orange. */
  stroke?: string
  strokeWidth?: number
  /** Render a small rough dot at each data point. */
  showDots?: boolean
  dotRadius?: number
  /**
   * Optional secondary line drawn over the data line (but under the dots) as a
   * crisp dashed path — e.g. a regression or rolling-average trend. Its x-type
   * must match the data's (`number` or `Date`); its points are folded into the
   * axis extents so it never clips. Fewer than two points renders nothing.
   */
  overlay?: { x: number | Date; y: number }[]
  /** Overlay line color. Defaults to a muted ink so the data line stays dominant. */
  overlayStroke?: string
  /** Overlay stroke width. Defaults to 1.5. */
  overlayStrokeWidth?: number
  /** Overlay `stroke-dasharray`. Defaults to `'6 4'` — reads as "computed". */
  overlayDash?: string
  xLabel?: string
  yLabel?: string
  xTickCount?: number
  yTickCount?: number
  xTickFormat?: (value: number | Date) => string
  yTickFormat?: (value: number) => string
}

function isDateValue(v: number | Date): v is Date {
  return v instanceof Date
}

export function RoughLine<T>({
  data,
  x,
  y,
  width,
  height,
  margin,
  stroke = chartPalette.rimOrange,
  strokeWidth = 2,
  showDots = true,
  dotRadius = 4,
  overlay,
  overlayStroke = chartPalette.inkSoft,
  overlayStrokeWidth = 1.5,
  overlayDash = '6 4',
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
  className,
  ariaLabel,
  ariaLabelledBy,
  emptyMessage,
}: RoughLineProps<T>): JSX.Element {
  const m = resolveMargin(margin)
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom

  if (data.length === 0) {
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

  const xValues = data.map(x)
  const yValues = data.map(y)
  const overlayXValues = overlay?.map((d) => d.x) ?? []
  const overlayYValues = overlay?.map((d) => d.y) ?? []
  const usingTime = isDateValue(xValues[0])

  // Each branch keeps its scale fully typed, so the rest of the function
  // can call `scaleX(value)` without union casts. The two branches are
  // structurally identical; the only difference is the input domain type.
  let scaleX: (value: number | Date) => number
  let xTicks: AxisTick[]
  if (usingTime) {
    const dateValues = xValues as Date[]
    const overlayTimes = (overlayXValues as Date[]).map((d) => d.getTime())
    const [tMin, tMax] = extent([...dateValues.map((d) => d.getTime()), ...overlayTimes])
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
    const [xMin, xMax] = extent([...(xValues as number[]), ...(overlayXValues as number[])])
    const linearScale: ScaleLinear<number, number> = scaleLinear()
      .domain([xMin, xMax])
      .range([0, innerW])
    scaleX = (v) => linearScale(v as number)
    xTicks = linearScale.ticks(xTickCount).map((tick) => ({
      value: xTickFormat ? xTickFormat(tick) : String(tick),
      offset: linearScale(tick),
    }))
  }

  const [yMin, yMax] = extent([...yValues, ...overlayYValues])
  const yPad = (yMax - yMin) * 0.1 || 1
  const yScale = scaleLinear()
    .domain([yMin - yPad, yMax + yPad])
    .nice()
    .range([innerH, 0])

  const points: [number, number][] = data.map((d) => [scaleX(x(d)), yScale(y(d))])
  const overlayPoints: [number, number][] =
    overlay?.map((d) => [scaleX(d.x), yScale(d.y)]) ?? []

  const gen = getGenerator()
  const linePath = gen.linearPath(points, { stroke, strokeWidth, roughness, seed })

  const yTicks: AxisTick[] = yScale.ticks(yTickCount).map((tick) => ({
    value: yTickFormat ? yTickFormat(tick) : String(tick),
    offset: yScale(tick),
  }))

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
        {drawableToPaths(linePath).map((p, i) => (
          <path
            key={`line-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {overlayPoints.length >= 2 && (
          <path
            data-testid="rough-line-overlay"
            d={overlayPoints
              .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`)
              .join(' ')}
            stroke={overlayStroke}
            strokeWidth={overlayStrokeWidth}
            strokeDasharray={overlayDash}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {showDots &&
          points.map(([px, py], i) => {
            const dot = gen.circle(px, py, dotRadius * 2, {
              fill: stroke,
              fillStyle: 'solid',
              stroke,
              strokeWidth: 1,
              roughness: roughness * 0.6,
              seed: seed + 300 + i,
            })
            return drawableToPaths(dot).map((p, j) => (
              <path
                key={`dot-${i}-${j}`}
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
