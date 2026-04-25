import type { JSX } from 'react'
import { scaleLinear } from 'd3-scale'
import { Axis, type AxisTick } from './axes'
import { chartPalette } from './palette'
import { drawableToPaths, getGenerator } from './rough-svg'
import { resolveMargin, type ChartCommonProps } from './types'

export interface RoughScatterProps<T> extends ChartCommonProps {
  data: T[]
  x: (d: T) => number
  y: (d: T) => number
  /** Optional per-point radius accessor (px). Defaults to constant 5. */
  r?: (d: T) => number
  fill?: string
  stroke?: string
  /** 'solid' for filled dots, 'hachure' for sketchy fills. */
  fillStyle?: 'hachure' | 'solid' | 'cross-hatch' | 'zigzag' | 'dots'
  xLabel?: string
  yLabel?: string
  xTickCount?: number
  yTickCount?: number
  xTickFormat?: (value: number) => string
  yTickFormat?: (value: number) => string
}

export function RoughScatter<T>({
  data,
  x,
  y,
  r,
  width,
  height,
  margin,
  fill = chartPalette.rimOrange,
  stroke = chartPalette.inkBlack,
  fillStyle = 'solid',
  roughness = 1.4,
  seed = 3,
  fontFamily = 'inherit',
  axisColor = chartPalette.inkBlack,
  xLabel,
  yLabel,
  xTickCount = 5,
  yTickCount = 5,
  xTickFormat,
  yTickFormat,
  className,
}: RoughScatterProps<T>): JSX.Element {
  const m = resolveMargin(margin)
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom

  const xValues = data.map(x)
  const yValues = data.map(y)

  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const xPad = (xMax - xMin) * 0.1 || 1
  const xScale = scaleLinear()
    .domain([xMin - xPad, xMax + xPad])
    .nice()
    .range([0, innerW])

  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  const yPad = (yMax - yMin) * 0.1 || 1
  const yScale = scaleLinear()
    .domain([yMin - yPad, yMax + yPad])
    .nice()
    .range([innerH, 0])

  const gen = getGenerator()

  const xTicks: AxisTick[] = xScale.ticks(xTickCount).map((tick) => ({
    value: xTickFormat ? xTickFormat(tick) : String(tick),
    offset: xScale(tick),
  }))

  const yTicks: AxisTick[] = yScale.ticks(yTickCount).map((tick) => ({
    value: yTickFormat ? yTickFormat(tick) : String(tick),
    offset: yScale(tick),
  }))

  const radiusOf = r ?? (() => 5)

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
        {data.map((d, i) => {
          const cx = xScale(x(d))
          const cy = yScale(y(d))
          const dotR = radiusOf(d)
          const dot = gen.circle(cx, cy, dotR * 2, {
            fill,
            fillStyle,
            stroke,
            strokeWidth: 1,
            roughness: roughness * 0.7,
            seed: seed + 1000 + i,
          })
          return drawableToPaths(dot).map((p, j) => (
            <path
              key={`pt-${i}-${j}`}
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
