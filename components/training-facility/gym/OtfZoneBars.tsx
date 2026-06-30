import type { JSX } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'

import { Axis, EmptyChart, type AxisTick } from '@/components/training-facility/shared/charts/axes'
import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import {
  drawableToPaths,
  getGenerator,
} from '@/components/training-facility/shared/charts/rough-svg'
import {
  resolveMargin,
  type ChartCommonProps,
} from '@/components/training-facility/shared/charts/types'
import type { OtfZoneBucket } from '@/lib/training-facility/otf'

/** Props for {@link OtfZoneBars}. */
export interface OtfZoneBarsProps extends ChartCommonProps {
  /** Pre-aggregated zone buckets (gray → red, in canonical order). */
  buckets: readonly OtfZoneBucket[]
  /** Inner padding between bars (0–1). Defaults to 0.25. */
  padding?: number
}

/**
 * Minutes-in-zone bar chart for the OrangeTheory Gym view — five bars
 * (gray/blue/green/orange/red), each tinted with the zone's brand color,
 * heights driven by total minutes in that zone across the filtered window.
 *
 * Sibling of `HrZoneBars` (the cardio Z1–Z5 chart). The shared `RoughBar`
 * primitive only takes one `fill`, so this inlines a renderer that asks
 * rough.js for one rectangle per bucket using `bucket.color`. OTF data is
 * already in minutes, so the y-axis needs no seconds→minutes switch.
 */
export function OtfZoneBars({
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
  ariaLabel = 'Minutes in heart-rate zone',
  ariaLabelledBy,
  emptyMessage = 'No zone data in range',
}: OtfZoneBarsProps): JSX.Element {
  const m = resolveMargin(margin)
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom

  const totalMinutes = buckets.reduce((acc, b) => acc + b.minutes, 0)
  if (totalMinutes === 0) {
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
    .domain(buckets.map(b => b.shortLabel))
    .range([0, innerW])
    .padding(padding)

  const yMax = Math.max(0, ...buckets.map(b => b.minutes))
  const yScale = scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

  const gen = getGenerator()

  const xTicks: AxisTick[] = buckets.map(b => ({
    value: b.shortLabel,
    offset: (xScale(b.shortLabel) ?? 0) + xScale.bandwidth() / 2,
  }))

  const yTicks: AxisTick[] = yScale.ticks(5).map(tick => ({
    value: `${Math.round(tick)}m`,
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
          // Zero buckets collapse entirely (no 1px baseline) — an OTF class
          // legitimately logs zero minutes in some zones and a stub bar would
          // read as "a little time here" when there was none.
          const bh = b.minutes > 0 ? Math.max(innerH - yScale(b.minutes), 1) : 0
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
              key={`otfzone-${b.key}-${j}`}
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
