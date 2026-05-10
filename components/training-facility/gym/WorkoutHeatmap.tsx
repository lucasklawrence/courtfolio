'use client'

import { useEffect, useRef, useState, type JSX } from 'react'

import { chartPalette } from '@/components/training-facility/shared/charts/palette'
import {
  buildHeatmapGrid,
  intensityLevel,
  type HeatmapCell,
} from '@/lib/training-facility/heatmap-grid'
import type { CardioSession } from '@/types/cardio'

/** Props for {@link WorkoutHeatmap}. */
export interface WorkoutHeatmapProps {
  /** All cardio sessions; the helper buckets them by local calendar day. */
  sessions: ReadonlyArray<Pick<CardioSession, 'date' | 'activity'>>
  /** Inclusive start of the visible window. Omit for the trailing 52 weeks. */
  dateFrom?: Date | null
  /** Inclusive end of the visible window. Defaults to today. */
  dateTo?: Date | null
  /**
   * Pixel width of one cell, including the trailing inter-cell gap; the
   * grid lays out columns left-to-right at this stride. Defaults to 14
   * but auto-scales upward when the wrapping container is wider than
   * the natural grid (the `?range=1m` filter case from #176 — was a
   * 70px grid in an 880px card before this).
   */
  cellSize?: number
  /** Pixel gap between cells. Defaults to 2. */
  cellGap?: number
  /**
   * Font family for the day-of-week and month labels. Defaults to `inherit`
   * so the surrounding `ChartCard` can drive the typeface.
   */
  fontFamily?: string
  /** Accessible label for the chart's `<svg>` `role="img"` wrapper. */
  ariaLabel?: string
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const
/** Pixel width reserved for the day-of-week label column. */
const DAY_LABEL_WIDTH = 32
/** Pixel height reserved for the month label row above the grid. */
const MONTH_LABEL_HEIGHT = 18
/** Default cell stride, used as the lower bound when auto-scaling. */
const DEFAULT_CELL_SIZE = 14
/** Cap on the auto-scaled stride so a 1-week filter doesn't render 200px cells. */
const MAX_CELL_SIZE = 28

/**
 * Color palette for the four intensity levels. Indexed by the value
 * `intensityLevel` returns. `0` is the empty cell (faint ink wash so the
 * empty grid is still visible against the cream `ChartCard`); 1–3 step
 * up the rim-orange saturation so denser weeks read as warmer.
 */
const CELL_COLORS = [
  'rgba(10, 10, 10, 0.07)',
  'rgba(234, 88, 12, 0.28)',
  'rgba(234, 88, 12, 0.62)',
  chartPalette.rimOrange,
] as const

/**
 * Calendar heatmap of cardio session frequency, ported from the standalone
 * cardio-dashboard repo (slice B of #75) and re-styled to the courtfolio
 * `chartPalette`. Plain `<rect>` cells inside an SVG so 52w × 7d ≈ 364
 * cells render instantly even on mobile — the surrounding `ChartCard`
 * provides the hand-drawn frame.
 *
 * Reads `dateFrom` / `dateTo` from the parent's `DateFilter` so the visible
 * window matches every other chart on the All Cardio Overview. Cells are
 * keyed by local calendar day; multiple sessions on the same day stack
 * into higher intensity buckets via {@link intensityLevel}.
 *
 * The `<title>` per cell is the native browser tooltip that reviewers see
 * on hover; screen readers also read it for keyboard navigation.
 */
export function WorkoutHeatmap({
  sessions,
  dateFrom,
  dateTo,
  cellSize,
  cellGap = 2,
  fontFamily = 'inherit',
  ariaLabel = 'Workout frequency heatmap',
}: WorkoutHeatmapProps): JSX.Element {
  const { grid, monthLabels } = buildHeatmapGrid(sessions, dateFrom, dateTo)
  const cols = grid[0]?.length ?? 0

  // Measure the wrapper so a short range (e.g. 1-month filter) can scale
  // its cells up to fill the surrounding card instead of leaving a sea
  // of empty space. Falls back to `DEFAULT_CELL_SIZE` until the
  // ResizeObserver fires once (server / first client paint). The
  // explicit `cellSize` prop, if supplied, overrides auto-scale.
  // (#176 slice B follow-up.)
  //
  // First-paint flicker trade-off (#190 item 4): the SSR pass and the
  // initial client paint both render at `DEFAULT_CELL_SIZE = 14`, then
  // the observer fires and the grid re-renders at the auto-scaled
  // size. On a fast connection this is a single frame; on a slow one
  // a viewer briefly sees the small grid before it grows. We accept
  // this because:
  //   - The card has a fixed surrounding height, so the re-render is a
  //     content swap, not a layout shift (CLS budget unaffected).
  //   - `useLayoutEffect` would tighten the paint but breaks SSR
  //     (`useLayoutEffect` warns on the server).
  //   - Pre-computing the width on the server would require threading
  //     the parent card's measured width through props — extra
  //     coupling for a single-pixel-flicker benefit.
  // Revisit if a user reports it or if the heatmap moves into a
  // surface where layout shift matters.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  useEffect(() => {
    const el = wrapperRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const computedCellSize =
    cellSize ?? (containerWidth && cols > 0
      ? Math.min(
          MAX_CELL_SIZE,
          Math.max(
            DEFAULT_CELL_SIZE,
            Math.floor((containerWidth - DAY_LABEL_WIDTH) / cols),
          ),
        )
      : DEFAULT_CELL_SIZE)
  const cellInner = computedCellSize - cellGap
  const gridWidth = cols * computedCellSize
  const gridHeight = 7 * computedCellSize
  // "Less" + 4 swatches separated by `computedCellSize + 1` + "More" — derive
  // from the same cell metrics as the legend itself so the legend doesn't
  // overflow the SVG when `computedCellSize` scales up to MAX_CELL_SIZE.
  const legendWidth = 32 + 4 * (computedCellSize + 1) + 4 + 28
  const totalWidth = DAY_LABEL_WIDTH + gridWidth
  const totalHeight = MONTH_LABEL_HEIGHT + gridHeight + 18 // +18 for the legend strip

  return (
    <div ref={wrapperRef}>
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width={totalWidth}
      height={totalHeight}
      role="img"
      aria-label={ariaLabel}
      style={{ fontFamily }}
    >
      {/* Month labels along the top */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT - 4})`}>
        {monthLabels.map((m) => (
          <text
            key={`month-${m.col}-${m.label}`}
            x={m.col * computedCellSize}
            y={0}
            fontSize={11}
            fill={chartPalette.inkSoft}
          >
            {m.label}
          </text>
        ))}
      </g>

      {/* Day-of-week labels along the left */}
      <g transform={`translate(0, ${MONTH_LABEL_HEIGHT})`}>
        {DAY_LABELS.map((label, row) =>
          label ? (
            <text
              key={`day-${row}`}
              x={DAY_LABEL_WIDTH - 6}
              y={row * computedCellSize + computedCellSize / 2 + 3}
              textAnchor="end"
              fontSize={10}
              fill={chartPalette.inkSoft}
            >
              {label}
            </text>
          ) : null,
        )}
      </g>

      {/* Heatmap cells */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT})`}>
        {grid.map((row, rowIdx) =>
          row.map((cell, colIdx) => (
            <rect
              key={`cell-${colIdx}-${rowIdx}`}
              x={colIdx * computedCellSize}
              y={rowIdx * computedCellSize}
              width={cellInner}
              height={cellInner}
              rx={2}
              ry={2}
              fill={CELL_COLORS[intensityLevel(cell.count)]}
            >
              <title>{describeCell(cell)}</title>
            </rect>
          )),
        )}
      </g>

      {/* Legend strip — "Less" + 4 swatches + "More" */}
      <g
        transform={`translate(${DAY_LABEL_WIDTH + gridWidth - legendWidth}, ${MONTH_LABEL_HEIGHT + gridHeight + 14})`}
      >
        <text x={0} y={0} fontSize={10} fill={chartPalette.inkSoft}>
          Less
        </text>
        {CELL_COLORS.map((color, i) => (
          <rect
            key={`legend-${i}`}
            x={32 + i * (computedCellSize + 1)}
            y={-9}
            width={cellInner}
            height={cellInner}
            rx={2}
            ry={2}
            fill={color}
          />
        ))}
        <text x={32 + 4 * (computedCellSize + 1) + 4} y={0} fontSize={10} fill={chartPalette.inkSoft}>
          More
        </text>
      </g>
    </svg>
    </div>
  )
}

/**
 * Compose the per-cell tooltip — `Apr 14, 2026: 2 sessions (Running, Walking)`
 * for active days, just the formatted date for empty days. Reads naturally
 * for both sighted users (browser title-tooltip on hover) and screen readers.
 */
function describeCell(cell: HeatmapCell): string {
  const dateLabel = cell.date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (cell.count === 0) return dateLabel
  const noun = cell.count === 1 ? 'session' : 'sessions'
  return `${dateLabel}: ${cell.count} ${noun} (${cell.types.join(', ')})`
}
