import type { JSX } from 'react'
import { drawableToPaths, getGenerator } from './rough-svg'

export interface EmptyChartProps {
  width: number
  height: number
  message?: string
  fontFamily?: string
  color?: string
  className?: string
  ariaLabel?: string
  ariaLabelledBy?: string
}

/**
 * Accessible "no data" placeholder rendered at the chart's footprint.
 * Used by the primitives when `data.length === 0` so callers don't have to
 * re-implement the empty branch — and so screen readers still get a label.
 */
export function EmptyChart({
  width,
  height,
  message = 'No data',
  fontFamily = 'inherit',
  color = '#737373',
  className,
  ariaLabel,
  ariaLabelledBy,
}: EmptyChartProps): JSX.Element {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? message)}
      aria-labelledby={ariaLabelledBy}
    >
      {!ariaLabelledBy && <title>{ariaLabel ?? message}</title>}
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily={fontFamily}
        fontSize={14}
        fill={color}
      >
        {message}
      </text>
    </svg>
  )
}

export interface AxisTick {
  value: string
  /** Distance along the axis from `start` (px). */
  offset: number
}

export interface AxisProps {
  orientation: 'bottom' | 'left'
  /** Cross-axis coordinate of the spine (y for bottom, x for left). */
  position: number
  /** Spine start coordinate along the primary axis (px). */
  start: number
  /** Spine end coordinate along the primary axis (px). */
  end: number
  ticks: AxisTick[]
  label?: string
  color: string
  fontFamily: string
  roughness: number
  seed: number
}

/**
 * Hand-drawn axis spine with straight tick marks and Patrick Hand labels.
 * The spine wobbles (rough.js); ticks stay straight so the values feel
 * carefully measured rather than uniformly sloppy.
 */
export function Axis({
  orientation,
  position,
  start,
  end,
  ticks,
  label,
  color,
  fontFamily,
  roughness,
  seed,
}: AxisProps): JSX.Element {
  const isBottom = orientation === 'bottom'
  const gen = getGenerator()

  const spine = isBottom
    ? gen.line(start, position, end, position, { stroke: color, strokeWidth: 1.5, roughness, seed })
    : gen.line(position, start, position, end, { stroke: color, strokeWidth: 1.5, roughness, seed })

  const tickLength = 5

  return (
    <g>
      {drawableToPaths(spine).map((p, i) => (
        <path
          key={`spine-${i}`}
          d={p.d}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          fill={p.fill ?? 'none'}
          strokeLinecap="round"
        />
      ))}
      {ticks.map((tick, i) => {
        if (isBottom) {
          const x = start + tick.offset
          return (
            <g key={`tick-${i}`}>
              <line
                x1={x}
                y1={position}
                x2={x}
                y2={position + tickLength}
                stroke={color}
                strokeWidth={1}
              />
              <text
                x={x}
                y={position + tickLength + 12}
                textAnchor="middle"
                fontFamily={fontFamily}
                fontSize={12}
                fill={color}
              >
                {tick.value}
              </text>
            </g>
          )
        }
        const y = start + tick.offset
        return (
          <g key={`tick-${i}`}>
            <line
              x1={position - tickLength}
              y1={y}
              x2={position}
              y2={y}
              stroke={color}
              strokeWidth={1}
            />
            <text
              x={position - tickLength - 4}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontFamily={fontFamily}
              fontSize={12}
              fill={color}
            >
              {tick.value}
            </text>
          </g>
        )
      })}
      {label && isBottom && (
        <text
          x={(start + end) / 2}
          y={position + 32}
          textAnchor="middle"
          fontFamily={fontFamily}
          fontSize={13}
          fill={color}
        >
          {label}
        </text>
      )}
      {label && !isBottom && (
        <text
          x={position - 32}
          y={(start + end) / 2}
          textAnchor="middle"
          fontFamily={fontFamily}
          fontSize={13}
          fill={color}
          transform={`rotate(-90 ${position - 32} ${(start + end) / 2})`}
        >
          {label}
        </text>
      )}
    </g>
  )
}
