import type { JSX } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import {
  Axis,
  EmptyChart,
  type AxisTick,
} from '@/components/training-facility/shared/charts/axes'
import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import {
  drawableToPaths,
  getGenerator,
} from '@/components/training-facility/shared/charts/rough-svg'
import {
  defaultMargin,
  resolveMargin,
  type ChartCommonProps,
} from '@/components/training-facility/shared/charts/types'
import type { HrZoneBucket } from '@/lib/training-facility/stair'

/** Props for {@link HrZoneBars}. */
export interface HrZoneBarsProps extends ChartCommonProps {
  /** Pre-aggregated zone buckets (Z1–Z5, in canonical order). */
  buckets: readonly HrZoneBucket[]
  /** Inner padding between bars (0–1). Defaults to 0.25. */
  padding?: number
}

/**
 * Time-in-zone bar chart for the Gym detail views — five bars (Z1–Z5), each
 * tinted with the zone's display color, heights driven by total seconds in
 * that zone across the filtered window.
 *
 * The shared `RoughBar` primitive only accepts a single `fill`, so this view
 * inlines a small custom renderer that asks rough.js for one rectangle per
 * bucket using `bucket.color` directly. Y-axis ticks are formatted as whole
 * minutes for legibility.
 */
export function HrZoneBars({
  buckets,
  width,
  height,
  margin,
  padding = 0.25,
  roughness = 1.4,
  seed = 4,
  fontFamily = 'inherit',
  axisColor = chartPalette.inkBlack,
  className,
  ariaLabel = 'Time in heart-rate zone',
  ariaLabelledBy,
  emptyMessage = 'No HR-zone data in range',
}: HrZoneBarsProps): JSX.Element {
  const m = resolveMargin(margin)
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom

  const totalSeconds = buckets.reduce((acc, b) => acc + b.seconds, 0)
  if (totalSeconds === 0) {
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

  const xScale = scaleBand<string>()
    .domain(buckets.map((b) => b.shortLabel))
    .range([0, innerW])
    .padding(padding)

  const yMaxSeconds = Math.max(0, ...buckets.map((b) => b.seconds))
  const yScale = scaleLinear().domain([0, yMaxSeconds]).nice().range([innerH, 0])

  const gen = getGenerator()

  const xTicks: AxisTick[] = buckets.map((b) => ({
    value: b.shortLabel,
    offset: (xScale(b.shortLabel) ?? 0) + xScale.bandwidth() / 2,
  }))

  const yTicks: AxisTick[] = yScale.ticks(5).map((tick) => ({
    value: `${Math.round(tick / 60)}m`,
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
          label="Zone"
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
          label="Minutes"
          color={axisColor}
          fontFamily={fontFamily}
          roughness={roughness}
          seed={seed + 200}
        />
        {buckets.map((b, i) => {
          const bx = xScale(b.shortLabel) ?? 0
          const bw = xScale.bandwidth()
          // Render zero buckets as a 1px baseline so the zone stays visible
          // on the axis even when no time was logged in it during the window.
          const bh = b.seconds > 0 ? Math.max(innerH - yScale(b.seconds), 1) : 0
          if (bh === 0) return null
          const by = innerH - bh
          const rect = gen.rectangle(bx, by, bw, bh, {
            fill: b.color,
            fillStyle: 'hachure',
            fillWeight: 2,
            hachureGap: 5,
            stroke: chartPalette.inkBlack,
            strokeWidth: 1.5,
            roughness,
            seed: seed + 1000 + i,
          })
          return drawableToPaths(rect).map((p, j) => (
            <path
              key={`hrzone-${b.zone}-${j}`}
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

/** Re-export the shared default margin so callers don't have to dig for it. */
export const hrZoneBarsDefaultMargin = defaultMargin
