import type { JSX } from 'react'

import {
  estimateTextWidth,
  monthLabelOverhang,
  thinMonthLabels,
} from '@/lib/training-facility/heatmap-labels'
import { intensityFromPct } from '@/lib/training-facility/weight-room-history'
import type { FocusDayCell } from '@/lib/training-facility/monthly-focus'
import type { MonthlyFocus } from '@/types/weight-room'
import { exerciseLabel } from '@/lib/training-facility/exercise-labels'

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
/** Font size for the month labels along the top axis. */
const MONTH_LABEL_FONT_SIZE = 11
/** Font size for the day-of-week labels and the legend text. */
const SMALL_LABEL_FONT_SIZE = 10
/**
 * Grid width, in pixels, that a short lane is scaled up toward by
 * {@link cellSizeForCols}. Roughly a half-width card on desktop.
 */
const TARGET_GRID_WIDTH = 420
/** Upper bound on the derived cell stride, so cells stay cells not tiles. */
const MAX_CELL_SIZE = 30
/** Legend swatch edge length, held at the base cell size regardless of stride. */
const LEGEND_SWATCH = 12
/** Vertical stride per legend row. */
const LEGEND_ROW_HEIGHT = 16
/** Gap between the grid's bottom edge and the legend's first baseline. */
const LEGEND_TOP_PAD = 14
/** Trailing space below the last legend row. */
const LEGEND_BOTTOM_PAD = 8
/** Gap between a legend swatch and its exercise name. */
const LEGEND_TEXT_GAP = 4
/** Gap between two legend columns. */
const LEGEND_COL_GAP = 12
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
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
  const empty: LaneGrid = {
    grid: Array.from({ length: 7 }, () => []),
    monthLabels: [],
    uniqueFocuses: [],
    cols: 0,
  }
  if (cells.length === 0) return empty

  const cellByDay = new Map(cells.map(c => [c.dayKey, c]))

  // Find Monday on/before the first cell.
  const startMonday = getMondayOf(cells[0].dayKey)

  // Find Sunday on/after the last cell.
  const lastDate = new Date(cells[cells.length - 1].dayKey + 'T12:00:00')
  const lastDow = lastDate.getDay() // 0 = Sun
  const daysToSunday = lastDow === 0 ? 0 : 7 - lastDow
  const endDate = new Date(
    lastDate.getFullYear(),
    lastDate.getMonth(),
    lastDate.getDate() + daysToSunday,
    12,
    0,
    0
  )

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
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  if (slot.cell === null) return dateLabel
  const { cell } = slot
  if (cell.focus === null) return `${dateLabel} (no focus)`
  if (cell.volume === 0) return `${dateLabel}: ${exerciseLabel(cell.focus)} — none logged`

  const unit = cell.focus.target_kind === 'sets' ? 'sets' : 'reps'
  const pctLabel = `${Math.round(cell.pct * 100)}% of daily goal`
  return `${dateLabel}: ${cell.volume} ${unit} ${exerciseLabel(cell.focus)} (${pctLabel})`
}

/**
 * Pixel stride per column for a grid `cols` wide.
 *
 * Unlike the per-exercise heatmap — which always spans a trailing 52 weeks
 * and so always fills its card — a lane spans only as much calendar as its
 * rotation history covers. A freshly-started rotation is a handful of
 * columns, which at the base stride renders as a postage stamp in a
 * full-width card (#370). Short spans therefore scale up toward
 * {@link TARGET_GRID_WIDTH}, capped at {@link MAX_CELL_SIZE}.
 *
 * Spans already wider than the target keep `base`, so once enough history
 * accumulates the lane renders at exactly the size it does today.
 *
 * The cap bounds only the *derived* scale-up, never `base` itself — an
 * explicit `cellSize` above the cap is a caller's deliberate choice, and
 * the prop's contract is a floor.
 */
function cellSizeForCols(cols: number, base: number): number {
  if (cols <= 0) return base
  return Math.max(base, Math.min(MAX_CELL_SIZE, Math.floor(TARGET_GRID_WIDTH / cols)))
}

/** One positioned entry in the legend strip. */
interface LegendEntry {
  /** The rotation segment this swatch stands for. */
  focus: MonthlyFocus
  /** X offset within the legend group. */
  x: number
  /** Y offset within the legend group (baseline of the label). */
  y: number
}

/** Legend geometry computed by {@link layoutLegend}. */
interface LegendLayout {
  /** Positioned entries, in first-appearance order. */
  entries: LegendEntry[]
  /** Total width consumed, so the SVG can widen to fit a long name. */
  width: number
  /** Total height consumed, including the pad above and below. */
  height: number
}

/**
 * Lay the rotation legend out in as many columns as `gridWidth` allows.
 *
 * Columns are uniform and sized to the **longest** exercise name, so a
 * short name can't let its neighbour creep underneath. The previous fixed
 * three-per-row split at `gridWidth / 3` put columns ~23px apart on a
 * narrow lane, overlapping every label (#370); it only escaped notice
 * because a single rotation renders a single swatch.
 */
function layoutLegend(focuses: readonly MonthlyFocus[], gridWidth: number): LegendLayout {
  if (focuses.length === 0) return { entries: [], width: 0, height: 0 }

  const widest = focuses.reduce(
    (max, f) => Math.max(max, estimateTextWidth(f.exercise, SMALL_LABEL_FONT_SIZE)),
    0
  )
  const stride = LEGEND_SWATCH + LEGEND_TEXT_GAP + widest + LEGEND_COL_GAP
  const perRow = Math.max(1, Math.floor(gridWidth / stride))

  const entries = focuses.map((focus, i) => ({
    focus,
    x: (i % perRow) * stride,
    y: Math.floor(i / perRow) * LEGEND_ROW_HEIGHT,
  }))

  const rows = Math.ceil(focuses.length / perRow)
  return {
    entries,
    width: Math.min(focuses.length, perRow) * stride - LEGEND_COL_GAP,
    height: LEGEND_TOP_PAD + (rows - 1) * LEGEND_ROW_HEIGHT + LEGEND_BOTTOM_PAD,
  }
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
   * `"Upper Focus Lane"`. Not rendered visibly — the surrounding card
   * owns the visible header.
   */
  label: string
  /**
   * Minimum pixel stride per cell (including the trailing inter-cell gap).
   * Defaults to `14` — same default as {@link import('./StrengthHeatmap').StrengthHeatmap}.
   *
   * A floor, not a fixed size: a lane covering few enough weeks to render
   * as a postage stamp is scaled up from here, capped at 30px. A lane wide
   * enough already renders at exactly this stride.
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

  // Derived, not the raw prop: a short rotation would otherwise render a
  // ~116px chart inside a ~900px card (#370). An explicit `cellSize` is
  // still the floor, so callers can only ever scale a lane up.
  const stride = cellSizeForCols(cols, cellSize)
  const cellInner = stride - cellGap
  const gridWidth = cols * stride
  const gridHeight = 7 * stride

  const visibleMonths = thinMonthLabels(monthLabels, { cellSize: stride, totalCols: cols })
  const monthOverhang = monthLabelOverhang(visibleMonths, stride, gridWidth, MONTH_LABEL_FONT_SIZE)

  const legend = layoutLegend(uniqueFocuses, gridWidth)

  // Widen for whichever of the two overhangs the content actually has: a
  // trailing month label hanging past the final column, or a legend row
  // longer than the grid it sits under.
  const contentWidth = Math.max(gridWidth + monthOverhang, legend.width)
  const totalWidth = DAY_LABEL_WIDTH + contentWidth
  const totalHeight = MONTH_LABEL_HEIGHT + gridHeight + legend.height

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width={totalWidth}
      height={totalHeight}
      role="img"
      aria-label={label}
      // Centered so a lane narrower than its card reads as a deliberately
      // compact chart rather than one pinned to the top-left corner. When
      // the lane is wider, the card's `overflow-x-auto` scrolls it and the
      // auto margins collapse to zero.
      style={{ display: 'block', marginInline: 'auto' }}
    >
      {/* Month labels along the top, thinned so neighbours can't collide */}
      <g transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT - 4})`}>
        {visibleMonths.map(m => (
          <text
            key={`month-${m.col}-${m.label}`}
            x={m.col * stride}
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
              y={row * stride + stride / 2 + 3}
              textAnchor="end"
              fontSize={SMALL_LABEL_FONT_SIZE}
              fill={LABEL_FILL}
            >
              {dayLabel}
            </text>
          ) : null
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
                x={colIdx * stride}
                y={rowIdx * stride}
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
          })
        )}
      </g>

      {/* Legend — one swatch + exercise label per rotation segment */}
      <g
        transform={`translate(${DAY_LABEL_WIDTH}, ${MONTH_LABEL_HEIGHT + gridHeight + LEGEND_TOP_PAD})`}
      >
        {legend.entries.map(({ focus, x, y }) => (
          <g key={focus.id} transform={`translate(${x}, ${y})`}>
            <rect
              x={0}
              y={-9}
              width={LEGEND_SWATCH}
              height={LEGEND_SWATCH}
              rx={2}
              ry={2}
              fill={focus.color}
              fillOpacity={1}
            />
            <text
              x={LEGEND_SWATCH + LEGEND_TEXT_GAP}
              y={0}
              fontSize={SMALL_LABEL_FONT_SIZE}
              fill={LABEL_FILL}
            >
              {exerciseLabel(focus)}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
