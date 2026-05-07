import type { JSX } from 'react'

import {
  buildStrengthHeatmap,
  intensityFromPct,
  type StrengthHeatmapCell,
} from '@/lib/training-facility/weight-room-history'
import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/** Props for {@link StrengthHeatmap}. */
export interface StrengthHeatmapProps {
  /**
   * Every logged set across all exercises; the component filters down
   * to {@link goal}'s exercise internally so callers can pass the
   * full `WeightRoomData.sets` list once per exercise.
   */
  sets: readonly StrengthSet[]
  /**
   * The exercise to render — supplies the color (used as the cell
   * fill at full intensity) and `daily_target` (the denominator that
   * decides which intensity bucket each cell falls into).
   */
  goal: ExerciseGoal
  /** Inclusive start of the visible window. Omit for the trailing 52 weeks. */
  dateFrom?: Date | null
  /** Inclusive end of the visible window. Defaults to today. */
  dateTo?: Date | null
  /**
   * Pixel width of one cell, including the trailing inter-cell gap; the
   * grid lays out columns left-to-right at this stride. Defaults to 14.
   */
  cellSize?: number
  /** Pixel gap between cells. Defaults to 2. */
  cellGap?: number
  /**
   * Font family for the day-of-week and month labels. Defaults to
   * `inherit` so the surrounding card can drive the typeface.
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
/** Pixel height reserved for the legend strip below the grid. */
const LEGEND_HEIGHT = 22

/**
 * Per-intensity opacity applied to the exercise's `goal.color`. Index
 * matches the value `intensityFromPct` returns: 0 = empty (no exercise
 * tint, just a faint white wash for grid visibility), 1 = light (1–49%
 * of goal), 2 = medium (50–99%), 3 = full (≥100%).
 *
 * Using `fill-opacity` over pre-mixed colors means a single hex color
 * from {@link ExerciseGoal.color} drives the whole exercise's heatmap
 * — adding a new exercise via the settings UI doesn't require a new
 * palette entry.
 */
const INTENSITY_OPACITY = [0, 0.28, 0.62, 1] as const

/** Background fill for empty (0%) cells — sits on a dark card. */
const EMPTY_CELL_FILL = 'rgba(247, 234, 217, 0.07)'

/** Soft cream label color matching the Weight Room dark surface. */
const LABEL_FILL = 'rgba(247, 234, 217, 0.55)'

/**
 * Calendar heatmap of one exercise's daily rep totals as a percentage
 * of the configured `daily_target` (PRD §7.6 / #81). Mirrors the
 * cardio-side {@link import('@/components/training-facility/gym/WorkoutHeatmap')}
 * layout — month labels on top, day-of-week on the left, legend strip
 * underneath — but colors cells by goal-percentage rather than session
 * count, and tints with {@link ExerciseGoal.color} so each exercise
 * reads as its own visual lane.
 *
 * Plain `<rect>` cells inside an SVG so 52w × 7d ≈ 364 cells render
 * instantly even on mobile. The `<title>` per cell is the native
 * browser tooltip ("Apr 14, 2026: 45 reps (2 sets, 45% of goal)") that
 * sighted users see on hover and screen readers read for keyboard nav.
 */
export function StrengthHeatmap({
  sets,
  goal,
  dateFrom,
  dateTo,
  cellSize = 14,
  cellGap = 2,
  fontFamily = 'inherit',
  ariaLabel,
}: StrengthHeatmapProps): JSX.Element {
  const { grid, monthLabels } = buildStrengthHeatmap(sets, goal, dateFrom, dateTo)
  const cols = grid[0]?.length ?? 0
  const cellInner = cellSize - cellGap
  const gridWidth = cols * cellSize
  const gridHeight = 7 * cellSize
  const totalWidth = DAY_LABEL_WIDTH + gridWidth
  const totalHeight = MONTH_LABEL_HEIGHT + gridHeight + LEGEND_HEIGHT
  const label = ariaLabel ?? `${goal.exercise} heatmap`

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width={totalWidth}
      height={totalHeight}
      role="img"
      aria-label={label}
      style={{ fontFamily, maxWidth: '100%', height: 'auto' }}
    >
      {/* Month labels along the top */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT - 4})`}>
        {monthLabels.map((m) => (
          <text
            key={`month-${m.col}-${m.label}`}
            x={m.col * cellSize}
            y={0}
            fontSize={11}
            fill={LABEL_FILL}
          >
            {m.label}
          </text>
        ))}
      </g>

      {/* Day-of-week labels along the left */}
      <g transform={`translate(0, ${MONTH_LABEL_HEIGHT})`}>
        {DAY_LABELS.map((dayLabel, row) =>
          dayLabel ? (
            <text
              key={`day-${row}`}
              x={DAY_LABEL_WIDTH - 6}
              y={row * cellSize + cellSize / 2 + 3}
              textAnchor="end"
              fontSize={10}
              fill={LABEL_FILL}
            >
              {dayLabel}
            </text>
          ) : null,
        )}
      </g>

      {/* Heatmap cells */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT})`}>
        {grid.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const level = intensityFromPct(cell.pct)
            const isEmpty = level === 0
            return (
              <rect
                key={`cell-${colIdx}-${rowIdx}`}
                x={colIdx * cellSize}
                y={rowIdx * cellSize}
                width={cellInner}
                height={cellInner}
                rx={2}
                ry={2}
                fill={isEmpty ? EMPTY_CELL_FILL : goal.color}
                fillOpacity={isEmpty ? 1 : INTENSITY_OPACITY[level]}
              >
                <title>{describeCell(cell, goal)}</title>
              </rect>
            )
          }),
        )}
      </g>

      {/* Legend strip — "Less" + 4 swatches + "More" */}
      <g
        transform={`translate(${DAY_LABEL_WIDTH + Math.max(0, gridWidth - 140)}, ${MONTH_LABEL_HEIGHT + gridHeight + 14})`}
      >
        <text x={0} y={0} fontSize={10} fill={LABEL_FILL}>
          Less
        </text>
        {INTENSITY_OPACITY.map((opacity, i) => {
          const empty = i === 0
          return (
            <rect
              key={`legend-${i}`}
              x={32 + i * (cellSize + 1)}
              y={-9}
              width={cellInner}
              height={cellInner}
              rx={2}
              ry={2}
              fill={empty ? EMPTY_CELL_FILL : goal.color}
              fillOpacity={empty ? 1 : opacity}
            />
          )
        })}
        <text x={32 + 4 * (cellSize + 1) + 4} y={0} fontSize={10} fill={LABEL_FILL}>
          More
        </text>
      </g>
    </svg>
  )
}

/**
 * Compose the per-cell tooltip — `Apr 14, 2026: 45 reps (2 sets, 45%
 * of goal)` for active days, just the formatted date for empty days.
 * Reads naturally for both sighted users (browser title-tooltip on
 * hover) and screen readers.
 */
function describeCell(cell: StrengthHeatmapCell, goal: ExerciseGoal): string {
  const dateLabel = cell.date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (cell.reps === 0) return dateLabel
  const setNoun = cell.setCount === 1 ? 'set' : 'sets'
  const pctLabel = `${Math.round(cell.pct * 100)}%`
  return `${dateLabel}: ${cell.reps} reps (${cell.setCount} ${setNoun}, ${pctLabel} of ${goal.exercise} goal)`
}
