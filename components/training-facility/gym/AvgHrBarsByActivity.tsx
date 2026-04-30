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
import {
  ACTIVITY_ORDER,
  ACTIVITY_VISUALS,
  type SessionAvgHrByActivityPoint,
} from '@/lib/training-facility/all-cardio'

/** Props for {@link AvgHrBarsByActivity}. */
export interface AvgHrBarsByActivityProps extends ChartCommonProps {
  /** Per-session avg-HR points (oldest → newest), each tagged with its activity. */
  points: readonly SessionAvgHrByActivityPoint[]
  /** Inner padding between bars (0–1). Defaults to 0.3. */
  padding?: number
}

/**
 * Activity-tinted variant of {@link ./AvgHrBars} for the All-Cardio overview
 * (PRD §7.4). Each bar is filled with the originating activity's color from
 * {@link ACTIVITY_VISUALS} so the chart simultaneously communicates the
 * avg-HR trend and the activity mix across the filtered window.
 *
 * Lives separately from `AvgHrBars` because the per-equipment detail views
 * intentionally render single-activity data in a single tint — adding an
 * `activity` axis to the shared component would push concerns from the
 * overview down into views that don't need it.
 *
 * The y-axis auto-pads around the observed range (same heuristic as the base
 * component) so a 12-BPM swing reads as a meaningful step rather than a 1px
 * nudge in a `[0, max]` domain.
 */
export function AvgHrBarsByActivity({
  points,
  width,
  height,
  margin,
  padding = 0.3,
  roughness = 1.4,
  seed = 12,
  fontFamily = 'inherit',
  axisColor = chartPalette.inkBlack,
  className,
  ariaLabel = 'Average heart rate per session, colored by activity',
  ariaLabelledBy,
  emptyMessage = 'No avg-HR sessions in range',
}: AvgHrBarsByActivityProps): JSX.Element {
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

  // Key by index — two sessions on the same calendar day (or the same M/D
  // across years) share a `label` value but are genuinely distinct points.
  const indices = points.map((_, i) => i)
  const xScale = scaleBand<number>().domain(indices).range([0, innerW]).padding(padding)

  const values = points.map((p) => p.avgHr)
  const [vMin, vMax] = extent(values)
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
          const fill = ACTIVITY_VISUALS[p.activity]?.color ?? chartPalette.rimOrange
          const rect = gen.rectangle(bx, by, bw, bh, {
            fill,
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
              key={`avghr-act-${i}-${j}`}
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

/** Props for {@link ActivityLegend}. */
export interface ActivityLegendProps {
  /** Tailwind classes appended to the legend wrapper. */
  className?: string
}

/**
 * Three-dot legend mapping the activity colors used by
 * {@link AvgHrBarsByActivity} to their labels. Pure presentation — pulls
 * directly from {@link ACTIVITY_VISUALS} so a future palette change ripples
 * through both the chart bars and the legend without manual sync.
 */
export function ActivityLegend({ className = '' }: ActivityLegendProps): JSX.Element {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/65 ${className}`}
      aria-label="Activity color legend"
    >
      {ACTIVITY_ORDER.map((activity) => {
        const visual = ACTIVITY_VISUALS[activity]
        return (
          <li key={activity} className="flex items-center gap-1.5 font-mono">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: visual.color }}
            />
            {visual.label}
          </li>
        )
      })}
    </ul>
  )
}
