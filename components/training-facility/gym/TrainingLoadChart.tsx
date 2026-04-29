import type { JSX } from 'react'
import { scaleLinear, scaleTime } from 'd3-scale'
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
import { TSB_ZONES, type TrainingLoadPoint } from '@/lib/training-facility/training-load'

/** Props for {@link TrainingLoadChart}. */
export interface TrainingLoadChartProps extends ChartCommonProps {
  /** Pre-computed series from `computeTrainingLoad(dailyTrimpSeries(sessions))`. */
  points: readonly TrainingLoadPoint[]
}

/** Series colors. ATL = rim-orange (acute, attention-grabbing), CTL = ink (chronic, anchoring), TSB = blue (delta line). */
const COLORS = {
  atl: chartPalette.rimOrange,
  ctl: chartPalette.inkBlack,
  tsb: '#1d4ed8',
  zoneRed: '#fee2e2',
  zoneYellow: '#fef9c3',
  zoneGreen: '#dcfce7',
} as const

/**
 * Training-load chart — three lines (ATL, CTL, TSB) with horizontal TSB zone
 * bands behind them (PRD #78).
 *
 * The chart uses the existing rough.js + d3-scale stack so its hand-drawn
 * voice matches the rest of the gym detail charts. ATL / CTL share the
 * primary y-axis (load units); TSB lands on the same y-axis since CTL − ATL
 * is the same scale. Zone bands paint between the documented TSB thresholds
 * (red < −10, yellow −10..5, green 5..25) clipped to the visible plot area.
 */
export function TrainingLoadChart({
  points,
  width,
  height,
  margin,
  roughness = 1.4,
  seed = 11,
  fontFamily = 'inherit',
  axisColor = chartPalette.inkBlack,
  className,
  ariaLabel = 'Training load — ATL, CTL, and TSB over time',
  ariaLabelledBy,
  emptyMessage = 'No training load data in range',
}: TrainingLoadChartProps): JSX.Element {
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

  const dates = points.map((p) => p.date.getTime())
  const [tMin, tMax] = extent(dates)
  const xScale = scaleTime()
    .domain([new Date(tMin), new Date(tMax)])
    .range([0, innerW])

  // y-domain spans both ATL / CTL (≥ 0) and TSB (can be negative). Pick the
  // tightest envelope across all three series, then pad ~10% so the lines
  // don't kiss the chart frame.
  const allValues = points.flatMap((p) => [p.atl, p.ctl, p.tsb])
  const [vMin, vMax] = extent(allValues)
  const yPad = Math.max(1, (vMax - vMin) * 0.1)
  const yScale = scaleLinear()
    .domain([vMin - yPad, vMax + yPad])
    .nice()
    .range([innerH, 0])

  const xTicks: AxisTick[] = xScale.ticks(5).map((tick) => ({
    value: tick.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    offset: xScale(tick),
  }))
  const yTicks: AxisTick[] = yScale.ticks(5).map((tick) => ({
    value: String(Math.round(tick)),
    offset: yScale(tick),
  }))

  const gen = getGenerator()

  const atlPath = gen.linearPath(
    points.map((p) => [xScale(p.date), yScale(p.atl)]),
    { stroke: COLORS.atl, strokeWidth: 2, roughness, seed: seed + 1 },
  )
  const ctlPath = gen.linearPath(
    points.map((p) => [xScale(p.date), yScale(p.ctl)]),
    { stroke: COLORS.ctl, strokeWidth: 2, roughness, seed: seed + 2 },
  )
  const tsbPath = gen.linearPath(
    points.map((p) => [xScale(p.date), yScale(p.tsb)]),
    { stroke: COLORS.tsb, strokeWidth: 1.8, roughness, seed: seed + 3 },
  )

  // Zone bands: clip each TSB threshold to the visible y-domain. yScale flips
  // (top y=0 maps to highest load), so a "red zone below −10" is the band
  // between yScale(−10) and yScale(yDomainMin) — the lower portion of the
  // plot. Drawn before the lines so the lines stay readable on top.
  const yDomain = yScale.domain() as [number, number]
  const yMinDomain = yDomain[0]
  const yMaxDomain = yDomain[1]
  const clamp = (v: number) => Math.max(yMinDomain, Math.min(yMaxDomain, v))

  const redTop = yScale(clamp(TSB_ZONES.redMax))
  const redBottom = yScale(yMinDomain)
  const yellowTop = yScale(clamp(TSB_ZONES.yellowMax))
  const yellowBottom = yScale(clamp(TSB_ZONES.redMax))
  const greenTop = yScale(clamp(TSB_ZONES.greenMax))
  const greenBottom = yScale(clamp(TSB_ZONES.yellowMax))

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
        {/* Zone bands behind everything else. */}
        {redBottom > redTop && (
          <rect
            x={0}
            y={redTop}
            width={innerW}
            height={redBottom - redTop}
            fill={COLORS.zoneRed}
            opacity={0.55}
          />
        )}
        {yellowBottom > yellowTop && (
          <rect
            x={0}
            y={yellowTop}
            width={innerW}
            height={yellowBottom - yellowTop}
            fill={COLORS.zoneYellow}
            opacity={0.55}
          />
        )}
        {greenBottom > greenTop && (
          <rect
            x={0}
            y={greenTop}
            width={innerW}
            height={greenBottom - greenTop}
            fill={COLORS.zoneGreen}
            opacity={0.55}
          />
        )}

        <Axis
          orientation="bottom"
          position={innerH}
          start={0}
          end={innerW}
          ticks={xTicks}
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
          label="Load"
          color={axisColor}
          fontFamily={fontFamily}
          roughness={roughness}
          seed={seed + 200}
        />

        {drawableToPaths(ctlPath).map((p, i) => (
          <path
            key={`ctl-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {drawableToPaths(atlPath).map((p, i) => (
          <path
            key={`atl-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {drawableToPaths(tsbPath).map((p, i) => (
          <path
            key={`tsb-${i}`}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4 3"
          />
        ))}

        {/* Inline legend in the upper-right of the plot area. Static,
            non-interactive — the goal is naming the three lines, not
            replacing tooltip-on-hover behavior. */}
        <g transform={`translate(${innerW - 110}, 8)`} fontFamily={fontFamily} fontSize={11}>
          <rect x={0} y={0} width={108} height={56} fill="rgba(255,255,255,0.78)" rx={4} />
          <line x1={6} y1={14} x2={22} y2={14} stroke={COLORS.atl} strokeWidth={2} />
          <text x={28} y={17} fill={chartPalette.inkBlack}>ATL · acute (7d)</text>
          <line x1={6} y1={30} x2={22} y2={30} stroke={COLORS.ctl} strokeWidth={2} />
          <text x={28} y={33} fill={chartPalette.inkBlack}>CTL · chronic (28d)</text>
          <line x1={6} y1={46} x2={22} y2={46} stroke={COLORS.tsb} strokeWidth={1.8} strokeDasharray="4 3" />
          <text x={28} y={49} fill={chartPalette.inkBlack}>TSB · CTL − ATL</text>
        </g>
      </g>
    </svg>
  )
}
