import type { CardioActivity, CardioSession } from '@/types/cardio'

import { ACTIVITY_VISUALS } from './all-cardio'
import { parseSessionDate } from './cardio-shared'

/** A single cell in the workout-frequency heatmap grid. */
export interface HeatmapCell {
  /** Local-time date this cell represents. */
  date: Date
  /** Number of sessions logged on {@link date}. `0` for empty days. */
  count: number
  /** Distinct activity labels (`Stair`, `Running`, `Walking`) for tooltips. */
  types: string[]
}

/** Result of {@link buildHeatmapGrid}. */
export interface HeatmapGrid {
  /** 7-row × N-column grid; row 0 is Monday, row 6 is Sunday. */
  grid: HeatmapCell[][]
  /** First-of-month markers for the column header labels. */
  monthLabels: { col: number; label: string }[]
}

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
/** Cap at ~2 years to limit DOM node count when a wide range is requested. */
const MAX_COLS = 104

/** Get the Monday at or before a given local date. */
function getMondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = m.getDay()
  m.setDate(m.getDate() - (dow === 0 ? 6 : dow - 1))
  return m
}

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

/**
 * Build a 7-row × N-column heatmap of session counts per local calendar day.
 * Row 0 is Monday so a typical year reads top-down as Mon→Sun. The grid
 * spans the supplied range when both `dateFrom` and `dateTo` are provided;
 * otherwise it falls back to the trailing 52 weeks ending at the current
 * week. Capped at {@link MAX_COLS} weeks (~2 years) to keep the DOM small
 * even when a long range is requested.
 *
 * Empty days have `count: 0` and `types: []` — the caller renders them as
 * the lowest-intensity cell. Multiple sessions on the same day increment
 * `count` once per session and add unique activity labels to `types`.
 *
 * @param sessions cardio sessions to aggregate; activity drives only the
 *   tooltip label, not the cell intensity.
 * @param dateFrom optional inclusive start of the range; clamped to
 *   {@link MAX_COLS} weeks before `dateTo` if the span exceeds the cap.
 * @param dateTo optional inclusive end; defaults to today.
 */
export function buildHeatmapGrid(
  sessions: ReadonlyArray<Pick<CardioSession, 'date' | 'activity'>>,
  dateFrom?: Date | null,
  dateTo?: Date | null,
): HeatmapGrid {
  const endMonday = getMondayOf(dateTo ?? new Date())
  const endDate = new Date(endMonday.getTime() + 6 * DAY_MS)

  let startMonday: Date
  if (dateFrom) {
    startMonday = getMondayOf(dateFrom)
    const maxStart = new Date(endMonday.getTime() - MAX_COLS * WEEK_MS)
    if (startMonday.getTime() < maxStart.getTime()) {
      startMonday = maxStart
    }
  } else {
    startMonday = new Date(endMonday.getTime() - 52 * WEEK_MS)
  }

  // Lookup: local-date key → { count, distinct activity labels }
  const lookup = new Map<string, { count: number; types: string[] }>()
  for (const s of sessions) {
    const d = parseSessionDate(s.date)
    if (!Number.isFinite(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const friendly = friendlyActivityLabel(s.activity)
    const entry = lookup.get(key)
    if (entry) {
      entry.count++
      if (!entry.types.includes(friendly)) entry.types.push(friendly)
    } else {
      lookup.set(key, { count: 1, types: [friendly] })
    }
  }

  // Use timestamp arithmetic (not setDate) so DST transitions don't desync
  // the column count from real elapsed weeks.
  const startMs = startMonday.getTime()
  const diffMs = endDate.getTime() - startMs
  const totalCols = Math.floor(diffMs / WEEK_MS) + 1
  const grid: HeatmapCell[][] = Array.from({ length: 7 }, () => [])
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1

  for (let col = 0; col < totalCols; col++) {
    for (let row = 0; row < 7; row++) {
      const date = new Date(startMs + (col * 7 + row) * DAY_MS)

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      const entry = lookup.get(key)

      grid[row].push({
        date,
        count: entry?.count ?? 0,
        types: entry?.types ?? [],
      })

      if (date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth()
        monthLabels.push({ col, label: MONTH_LABELS[date.getMonth()] })
      }
    }
  }

  return { grid, monthLabels }
}

/**
 * Bucket a session count into one of four intensity levels for the heatmap
 * cell color. `0` is the empty/baseline level; `3` is the max ("3+ sessions").
 */
export function intensityLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  return 3
}

function friendlyActivityLabel(activity: CardioActivity): string {
  return ACTIVITY_VISUALS[activity].label
}
