import type { JSX } from 'react'

import { intensityFromPct } from '@/lib/training-facility/weight-room-history'
import type { FocusDayCell } from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'

// ---------------------------------------------------------------------------
// Layout constants — match StrengthHeatmap.tsx so the two components sit in
// the same visual lane system (same row heights, same label widths, same
// legend strip height).
// ---------------------------------------------------------------------------

/** Pixel width reserved for the day-of-week label column. */
const DAY_LABEL_WIDTH = 32
/** Pixel height reserved for the month label row above the grid. */
const MONTH_LABEL_HEIGHT = 18
/**
 * Per-intensity opacity applied to the focus color — index matches the
 * value returned by `intensityFromPct`: 0 = no fill (empty), 1 = 1–49%
 * of goal, 2 = 50–99%, 3 = ≥100%.
 */
const INTENSITY_OPACITY = [0, 0.28, 0.62, 1] as const
/** Background fill for gap cells (no active focus) and padding cells. */
const EMPTY_CELL_FILL = 'rgba(247, 234, 217, 0.07)'
/** Soft cream label color for month and day-of-week labels. */
const LABEL_FILL = 'rgba(247, 234, 217, 0.55)'
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const
const DAY_MS = 86_400_000

// ---------------------------------------------------------------------------
// Internal grid helpers
// ---------------------------------------------------------------------------

/**
 * Convert a `Date` to a `YYYY-MM-DD` key using local-time components.
 * Private — callers outside this file use `toLocalDateKey` from
 * `strength-today`. Kept here so the component has no runtime import from
 * the lib layer (the cells already carry `dayKey`).
 */
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Return the Monday on or before `dayKey`, as a `Date` at local noon.
 * Mirrors the private `getMondayOf` in `weight-room-history.ts`.
 */
function getMondayOf(dayKey: string): Date {
  const d = new Date(dayKey + 'T12:00:00')
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
  const dow = m.getDay() // 0 = Sun
  m.setDate(m.getDate() - (dow === 0 ? 6 : dow - 1))
  return m
}

/** One column slot in the SVG grid. */
interface GridSlot {
  /** Local `YYYY-MM-DD` key. */
  dayKey: string
  /**
   * The matching cell from `buildFocusLaneCells`, or `null` for padding
   * slots (before the first cell or after the last).
   */
  cell: FocusDayCell | null
}

/** Pre-computed grid arrays + metadata returned by {@link buildLaneGrid}. */
interface LaneGrid {
  /** 7 rows (Mon–Sun) × N columns; row 0 = Monday. */
  grid: GridSlot[][]
  /** Month label positions for the top axis. */
  monthLabels: { col: number; label: string }[]
  /**
   * Unique focuses in first-appearance order, used to build the legend
   * strip (one colored swatch per rotation segment).
   */
  uniqueFocuses: MonthlyFocus[]
  /** Total column count (= `grid[0].length`). */
  cols: number
}

/**
 * Build the 7-row × N-col grid from an ordered array of
 * {@link FocusDayCell}s. The grid starts on the Monday on/before the first
 * cell and ends on the Sunday on/after the last cell, padding any empty
 * slots at the start or end with `null`.
 */
function buildLaneGrid(cells: readonly FocusDayCell[]): LaneGrid {
  const empty: LaneGrid = { grid: Array.from({ length: 7 }, () => []), monthLabels: [], uniqueFocuses: [], cols: 0 }
  if (cells.length === 0) return empty

  const cellByDay = new Map(cells.map((c) => [c.dayKey, c]))

  // Find Monday on/before the first cell.
  const startMonday = getMondayOf(cells[0].dayKey)

  // Find Sunday on/after the last cell.
  const lastDate = new Date(cells[cells.length - 1].dayKey + 'T12:00:00')
  const lastDow = lastDate.getDay() // 0 = Sun
  const daysToSunday = lastDow === 0 ? 0 : 7 - lastDow
  const endDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + daysToSunday, 12, 0, 0)

  const startMs = startMonday.getTime()
  const totalCols = Math.round((endDate.getTime() - startMs) / (7 * DAY_MS)) + 1

  const grid: GridSlot[][] = Array.from({ length: 7 }, () => [])
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1

  for (let col = 0; col < totalCols; col++) {
    for (let row = 0; row < 7; row++) {
      const date = new Date(startMs + (col * 7 + row) * DAY_MS)
      const dk = toDateKey(date)
      grid[row].push({ dayKey: dk, cell: cellByDay.get(dk) ?? null })
      if (row === 0 && date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth()
        monthLabels.push({ col, label: MONTH_LABELS[date.getMonth()] })
      }
    }
  }

  // Collect unique focuses in first-appearance order for the legend.
  const seen = new Set<string>()
  const uniqueFocuses: MonthlyFocus[] = []
  for (const cell of cells) {
    if (cell.focus !== null && !seen.has(cell.focus.id)) {
      seen.add(cell.focus.id)
      uniqueFocuses.push(cell.focus)
    }
  }

  return { grid, monthLabels, uniqueFocuses, cols: totalCols }
}

/**
 * Compose the per-cell SVG `<title>` tooltip string. Shows the local date,
 * the focus exercise, and the day's volume + percentage when a set was
 * logged. Reads naturally for sighted hover and screen-reader keyboard nav.
 */
function describeSlot(slot: GridSlot): string {
  const date = new Date(slot.dayKey + 'T12:00:00')
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (slot.cell === null) return dateLabel
  const { cell } = slot
  if (cell.focus === null) return `${dateLabel} (no focus)`
  if (cell.volume === 0) return `${dateLabel}: ${cell.focus.exercise} — none logged`

  const unit = cell.focus.target_kind === 'sets' ? 'sets' : 'reps'
  const pctLabel = `${Math.round(cell.pct * 100)}% of daily goal`
  return `${dateLabel}: ${cell.volume} ${unit} ${cell.focus.exercise} (${pctLabel})`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Props for {@link FocusLaneHeatmap}. */
export interface FocusLaneHeatmapProps {
  /**
   * Ordered cells for one body-region lane, built by
   * `buildFocusLaneCells`. Cells span `[earliestStart, today]`; each
   * carries the active focus (or `null` for a gap) and the normalized
   * volume for that day.
   */
  cells: FocusDayCell[]
  /**
   * Accessible label for the SVG `role="img"` wrapper, e.g.
   * `"Upper Focus Lane"`. Also shown as the lane header.
   */
  label: string
  /**
   * Pixel stride per cell (including the trailing inter-cell gap).
   * Defaults to `14` — same default as {@link import('./StrengthHeatmap').StrengthHeatmap}.
   */
  cellSize?: number
  /** Pixel gap between cells. Defaults to `2`. */
  cellGap?: number
}

/**
 * Stitched calendar heatmap for one body-region focus lane (#361). Plots
 * the daily goal attainment (% of `daily_target`) across all past and
 * current focus rotations for the lane, coloring each cell by the
 * exercise's own focus color so transitions are visually distinct. Gap
 * periods between focus windows appear as faint grey cells.
 *
 * Unlike {@link import('./StrengthHeatmap').StrengthHeatmap}, which
 * anchors to the trailing 52 weeks of one exercise, this heatmap spans the
 * full focus history for a lane so the rotation story is legible at a
 * glance.
 *
 * Plain `<rect>` SVG cells so the grid renders instantly even on mobile.
 */
export function FocusLaneHeatmap({
  cells,
  label,
  cellSize = 14,
  cellGap = 2,
}: FocusLaneHeatmapProps): JSX.Element | null {
  if (cells.length === 0) return null

  const { grid, monthLabels, uniqueFocuses, cols } = buildLaneGrid(cells)
  const cellInner = cellSize - cellGap
  const gridWidth = cols * cellSize
  const gridHeight = 7 * cellSize

  // Legend height: one row at 22 px, plus 16 px per additional row (up to
  // ⌈uniqueFocuses.length / 3⌉ rows at 3 items per row).
  const legendRows = Math.max(1, Math.ceil(uniqueFocuses.length / 3))
  const legendHeight = 22 + (legendRows - 1) * 16
  const totalWidth = DAY_LABEL_WIDTH + gridWidth
  const totalHeight = MONTH_LABEL_HEIGHT + gridHeight + legendHeight

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width={totalWidth}
      height={totalHeight}
      role="img"
      aria-label={label}
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

      {/* Heatmap cells — colored by the active focus, grey for gaps */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT})`}>
        {grid.map((row, rowIdx) =>
          row.map((slot, colIdx) => {
            const focus = slot.cell?.focus ?? null
            const pct = slot.cell?.pct ?? 0
            const isGap = focus === null
            const level = isGap ? 0 : intensityFromPct(pct)

            return (
              <rect
                key={`cell-${colIdx}-${rowIdx}`}
                x={colIdx * cellSize}
                y={rowIdx * cellSize}
                width={cellInner}
                height={cellInner}
                rx={2}
                ry={2}
                fill={isGap ? EMPTY_CELL_FILL : focus.color}
                fillOpacity={isGap ? 1 : INTENSITY_OPACITY[level]}
              >
                <title>{describeSlot(slot)}</title>
              </rect>
            )
          }),
        )}
      </g>

      {/* Legend — one swatch + exercise label per rotation segment */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT + gridHeight + 14})`}>
        {uniqueFocuses.map((focus, i) => {
          const col = i % 3
          const row = Math.floor(i / 3)
          const x = col * Math.floor(gridWidth / 3)
          const y = row * 16
          return (
            <g key={focus.id} transform={`translate(${x}, ${y})`}>
              <rect
                x={0}
                y={-9}
                width={cellInner}
                height={cellInner}
                rx={2}
                ry={2}
                fill={focus.color}
                fillOpacity={1}
              />
              <text x={cellSize + 2} y={0} fontSize={10} fill={LABEL_FILL}>
                {focus.exercise}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
