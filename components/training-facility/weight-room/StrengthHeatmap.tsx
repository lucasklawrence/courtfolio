import type { JSX } from 'react'

import { formatDayKey } from '@/lib/training-facility/day-keys'
import { type GoalTargetChange, goalTargetChanges } from '@/lib/training-facility/goal-targets'
import { monthLabelOverhang, thinMonthLabels } from '@/lib/training-facility/heatmap-labels'
import {
  buildStrengthHeatmap,
  intensityFromPct,
  type StrengthHeatmapCell,
  type StrengthHeatmapGrid,
} from '@/lib/training-facility/weight-room-history'
import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

import { GoalChangeMarker } from './GoalChangeMarker'

/** Props for {@link StrengthHeatmap}. */
export interface StrengthHeatmapProps {
  /**
   * Every logged set across all exercises; the component filters down
   * to {@link goal}'s exercise internally so callers can pass the
   * full `WeightRoomData.sets` list once per exercise.
   */
  sets: readonly StrengthSet[]
  /**
   * The exercise to render — supplies the color (used as the cell fill at
   * full intensity) and the daily target behind each cell's intensity
   * bucket.
   *
   * That denominator is resolved **per day** from `target_history` (#362),
   * not read off the current `daily_target`, so cells on either side of a
   * goal change keep the intensity they earned. Any change in the history
   * that falls inside the rendered window also draws a boundary marker.
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
/** Font size the month labels are drawn at. */
const MONTH_LABEL_FONT_SIZE = 11

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
  const heatmap = buildStrengthHeatmap(sets, goal, dateFrom, dateTo)
  const { grid, monthLabels } = heatmap
  const cols = grid[0]?.length ?? 0
  const cellInner = cellSize - cellGap
  const gridWidth = cols * cellSize
  const gridHeight = 7 * cellSize

  // Month-label geometry (#370). Both halves matter even though a default
  // 52-week window trips neither: months land ~4.3 columns apart so nothing
  // is thinned, and the trailing label sits far from the right edge so
  // nothing overhangs. A caller narrowing `dateFrom`/`dateTo` hits both.
  const visibleMonths = thinMonthLabels(monthLabels, { cellSize, totalCols: cols })
  const monthOverhang = monthLabelOverhang(
    visibleMonths,
    cellSize,
    gridWidth,
    MONTH_LABEL_FONT_SIZE,
  )

  const totalWidth = DAY_LABEL_WIDTH + gridWidth + monthOverhang
  const totalHeight = MONTH_LABEL_HEIGHT + gridHeight + LEGEND_HEIGHT
  const label = ariaLabel ?? `${goal.exercise} heatmap`

  // Boundary markers for target changes (#362), dropped to whichever column
  // holds the effective date. Changes outside the visible window resolve to
  // `null` and are filtered out rather than clamped to an edge, which would
  // plant a marker on a week the change didn't happen in.
  const visibleChanges = goalTargetChanges(goal)
    .map((change) => ({ change, col: columnForDayKey(heatmap, change.effective_from) }))
    .filter((entry): entry is { change: GoalTargetChange; col: number } => entry.col !== null)

  return (
    // No `maxWidth: 100%` on the SVG — the page wraps each heatmap in
    // an `overflow-x-auto` card so the trailing-52w grid (≈760 px) can
    // scroll horizontally on mobile. Capping the SVG to the container
    // would defeat that and squash 364 cells into a phone width.
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width={totalWidth}
      height={totalHeight}
      role="img"
      aria-label={label}
      style={{ fontFamily }}
    >
      {/* Month labels along the top, thinned so neighbours can't collide */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT - 4})`}>
        {visibleMonths.map((m) => (
          <text
            key={`month-${m.col}-${m.label}`}
            x={m.col * cellSize}
            y={0}
            fontSize={MONTH_LABEL_FONT_SIZE}
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

      {/* Goal-change boundary markers, drawn over the cells so the rule
          reads as an annotation rather than another data mark (#362). */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT})`}>
        {visibleChanges.map(({ change, col }) => (
          <GoalChangeMarker
            key={`goal-change-${change.effective_from}`}
            change={change}
            x={col * cellSize - cellGap / 2}
            y={0}
            height={gridHeight}
          />
        ))}
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
 *
 * The percentage is against the target in effect *that* day, so a cell on
 * the far side of a goal change explains its own colour (#362).
 *
 * Formatted from the cell's day key through {@link formatDayKey}, which pins
 * the Pacific zone (#319). Formatting `cell.date` in viewer-local time would
 * name the *following* day for anyone at UTC+5 or east of it, so the tooltip
 * would contradict the square it's attached to.
 */
function describeCell(cell: StrengthHeatmapCell, goal: ExerciseGoal): string {
  const dateLabel = formatDayKey(
    cell.dayKey,
    { month: 'short', day: 'numeric', year: 'numeric' },
    'en-US',
  )
  if (cell.reps === 0) return dateLabel
  const setNoun = cell.setCount === 1 ? 'set' : 'sets'
  const pctLabel = `${Math.round(cell.pct * 100)}%`
  return `${dateLabel}: ${cell.reps} reps (${cell.setCount} ${setNoun}, ${pctLabel} of ${cell.dailyTarget} ${goal.exercise} goal)`
}

/**
 * Column index whose week contains `dayKey`, or `null` when the day falls
 * outside the rendered window.
 *
 * Scans the Monday row and returns the last column that starts on or before
 * the target day — the grid's columns are contiguous weeks, so that column is
 * the one containing it.
 *
 * Compares each cell's own `dayKey` (#319). This used to re-derive a key from
 * `cell.date` in the *viewer's* timezone, which could name a different day
 * than the cell was built for and drop a marker onto the neighbouring column.
 *
 * @param heatmap The built grid to locate the day within.
 * @param dayKey `YYYY-MM-DD` day to find.
 */
function columnForDayKey(heatmap: StrengthHeatmapGrid, dayKey: string): number | null {
  const mondays = heatmap.grid[0]
  if (mondays === undefined || mondays.length === 0) return null

  // Before the first rendered week — the change predates the window.
  if (dayKey < mondays[0].dayKey) return null

  let found = -1
  for (let col = 0; col < mondays.length; col++) {
    if (mondays[col].dayKey <= dayKey) found = col
    else break
  }
  if (found === -1) return null

  // Past the final week's Sunday — the change is after the window.
  const lastRow = heatmap.grid[6]
  if (lastRow !== undefined && found === mondays.length - 1) {
    const sunday = lastRow[found]
    if (sunday !== undefined && dayKey > sunday.dayKey) return null
  }
  return found
}
