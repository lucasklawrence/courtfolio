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
  extent,
  getGenerator,
} from '@/components/training-facility/shared/charts/rough-svg'
import {
  resolveMargin,
  type ChartCommonProps,
} from '@/components/training-facility/shared/charts/types'
import type { SessionAvgHrPoint } from '@/lib/training-facility/stair'

/** Props for {@link AvgHrBars}. */
export interface AvgHrBarsProps extends ChartCommonProps {
  /** Per-session avg-HR points, oldest → newest. */
  points: readonly SessionAvgHrPoint[]
  /** Inner padding between bars (0–1). Defaults to 0.3. */
  padding?: number
}

/**
 * Per-session average heart-rate bar chart for the stair detail view.
 *
 * Why this lives outside `RoughBar`: avg-HR values typically cluster in a
 * narrow 130–170 BPM band. With `RoughBar`'s default `[0, yMax]` domain, every
 * bar fills ~85–99% of the chart and the trend disappears. This view auto-pads
 * the domain around the actual range so a 12-BPM week-over-week swing reads as
 * a meaningful step rather than a 1px nudge.
 */
export function AvgHrBars({
  points,
  width,
  height,
  margin,
  padding = 0.3,
  roughness = 1.4,
  seed = 8,
  fontFamily = 'inherit',
  axisColor = chartPalette.inkBlack,
  className,
  ariaLabel = 'Average heart rate per session',
  ariaLabelledBy,
  emptyMessage = 'No avg-HR sessions in range',
}: AvgHrBarsProps): JSX.Element {
  const m = resolveMargin(margin)
  const innerW = width - m.left - m.right
  const innerH = height - m.top - m.bottom

  if (points.length === 0) {
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

  // Key the band scale by index, not by `label`. Two sessions on the same
  // calendar day (or the same M/D across years) share a `label` value but
  // are genuinely distinct points — a string-keyed domain would collapse
  // them onto a single x position. Tick text still shows the M/D label.
  const indices = points.map((_, i) => i)
  const xScale = scaleBand<number>().domain(indices).range([0, innerW]).padding(padding)

  const values = points.map((p) => p.avgHr)
  const [vMin, vMax] = extent(values)
  // Pad the domain by ~15% of the observed range (or ±5 BPM if every session
  // had the same avg HR) so adjacent bars read as different heights instead of
  // collapsing to a single visual step. Lower bound stays >= 0.
  const span = vMax - vMin
  const pad = span > 0 ? span * 0.15 : 5
  const yDomainMin = Math.max(0, Math.floor(vMin - pad))
  const yDomainMax = Math.ceil(vMax + pad)
  const yScale = scaleLinear().domain([yDomainMin, yDomainMax]).nice().range([innerH, 0])

  const gen = getGenerator()

  const xTicks: AxisTick[] = points.map((p, i) => ({
    value: p.label,
    offset: (xScale(i) ?? 0) + xScale.bandwidth() / 2,
  }))

  const yTicks: AxisTick[] = yScale.ticks(5).map((tick) => ({
    value: String(tick),
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
          label="Session"
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
          label="Avg HR (BPM)"
          color={axisColor}
          fontFamily={fontFamily}
          roughness={roughness}
          seed={seed + 200}
        />
        {points.map((p, i) => {
          const bx = xScale(i) ?? 0
          const bw = xScale.bandwidth()
          const bh = Math.max(innerH - yScale(p.avgHr), 1)
          const by = innerH - bh
          const rect = gen.rectangle(bx, by, bw, bh, {
            fill: chartPalette.rimOrange,
            fillStyle: 'hachure',
            fillWeight: 2,
            hachureGap: 5,
            stroke: chartPalette.inkBlack,
            strokeWidth: 1.5,
            roughness,
            seed: seed + 1000 + i,
          })
          return drawableToPaths(rect).map((path, j) => (
            <path
              key={`avghr-${i}-${j}`}
              d={path.d}
              stroke={path.stroke}
              strokeWidth={path.strokeWidth}
              fill={path.fill ?? 'none'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        })}
      </g>
    </svg>
  )
}
