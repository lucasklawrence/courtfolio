import type { JSX } from 'react'
import { scaleLinear, scaleTime, type ScaleLinear, type ScaleTime } from 'd3-scale'
import { Axis, type AxisTick } from './axes'
import { chartPalette } from './palette'
import { drawableToPaths, getGenerator } from './rough-svg'
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
}: RoughLineProps<T>): JSX.Element {
  const m = resolveMargin(margin)
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom

  const xValues = data.map(x)
  const yValues = data.map(y)
  const usingTime = xValues.length > 0 && isDateValue(xValues[0])

  const xScale: ScaleTime<number, number> | ScaleLinear<number, number> = usingTime
    ? scaleTime()
        .domain([
          new Date(Math.min(...(xValues as Date[]).map((d) => d.getTime()))),
          new Date(Math.max(...(xValues as Date[]).map((d) => d.getTime()))),
        ])
        .range([0, innerW])
    : scaleLinear()
        .domain([Math.min(...(xValues as number[])), Math.max(...(xValues as number[]))])
        .range([0, innerW])

  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  const yPad = (yMax - yMin) * 0.1 || 1
  const yScale = scaleLinear()
    .domain([yMin - yPad, yMax + yPad])
    .nice()
    .range([innerH, 0])

  const points: [number, number][] = data.map((d) => [
    xScale(x(d) as Date & number),
    yScale(y(d)),
  ])

  const gen = getGenerator()
  const linePath = gen.linearPath(points, { stroke, strokeWidth, roughness, seed })

  const xTicks: AxisTick[] = (
    usingTime
      ? (xScale as ScaleTime<number, number>).ticks(xTickCount)
      : (xScale as ScaleLinear<number, number>).ticks(xTickCount)
  ).map((tick) => ({
    value: xTickFormat
      ? xTickFormat(tick)
      : usingTime
        ? (tick as Date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : String(tick),
    offset: xScale(tick as Date & number),
  }))

  const yTicks: AxisTick[] = yScale.ticks(yTickCount).map((tick) => ({
    value: yTickFormat ? yTickFormat(tick) : String(tick),
    offset: yScale(tick),
  }))

  return (
    <svg width={width} height={height} className={className} role="img">
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
