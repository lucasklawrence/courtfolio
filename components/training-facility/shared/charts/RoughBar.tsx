import type { JSX } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { Axis, EmptyChart, type AxisTick } from './axes'
import { chartPalette } from './palette'
import { drawableToPaths, getGenerator } from './rough-svg'
import { resolveMargin, type ChartCommonProps } from './types'

export interface RoughBarProps<T> extends ChartCommonProps {
  data: T[]
  x: (d: T) => string
  y: (d: T) => number
  fill?: string
  stroke?: string
  fillStyle?: 'hachure' | 'solid' | 'cross-hatch' | 'zigzag' | 'dots' | 'sunburst' | 'dashed'
  /** Inner padding between bars (0–1). */
  padding?: number
  xLabel?: string
  yLabel?: string
  yTickCount?: number
  yTickFormat?: (value: number) => string
}

export function RoughBar<T>({
  data,
  x,
  y,
  width,
  height,
  margin,
  fill = chartPalette.hardwoodTan,
  stroke = chartPalette.inkBlack,
  fillStyle = 'hachure',
  padding = 0.25,
  roughness = 1.4,
  seed = 2,
  fontFamily = 'inherit',
  axisColor = chartPalette.inkBlack,
  xLabel,
  yLabel,
  yTickCount = 5,
  yTickFormat,
  className,
  ariaLabel,
  ariaLabelledBy,
  emptyMessage,
}: RoughBarProps<T>): JSX.Element {
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

  const categories = data.map(x)
  const xScale = scaleBand<string>().domain(categories).range([0, innerW]).padding(padding)

  const yMax = Math.max(0, ...data.map(y))
  const yScale = scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

  const gen = getGenerator()

  const xTicks: AxisTick[] = categories.map((c) => ({
    value: c,
    offset: (xScale(c) ?? 0) + xScale.bandwidth() / 2,
  }))

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
        {data.map((d, i) => {
          const cat = x(d)
          const value = y(d)
          const bx = xScale(cat) ?? 0
          const by = yScale(value)
          const bw = xScale.bandwidth()
          const bh = innerH - by
          if (bh <= 0) return null
          const rect = gen.rectangle(bx, by, bw, bh, {
            fill,
            fillStyle,
            fillWeight: 2,
            hachureGap: 5,
            stroke,
            strokeWidth: 1.5,
            roughness,
            seed: seed + 1000 + i,
          })
          return drawableToPaths(rect).map((p, j) => (
            <path
              key={`bar-${i}-${j}`}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              fill={p.fill ?? 'none'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        })}
      </g>
    </svg>
  )
}
