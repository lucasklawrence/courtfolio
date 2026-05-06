import { describe, it, expect, vi, afterEach } from 'vitest'

import type { CardioSession } from '@/types/cardio'

import { buildHeatmapGrid, intensityLevel, type HeatmapGrid } from './heatmap-grid'

function findCell(grid: HeatmapGrid['grid'], year: number, month: number, day: number) {
  for (const row of grid) {
    for (const cell of row) {
      if (
        cell.date.getFullYear() === year &&
        cell.date.getMonth() === month &&
        cell.date.getDate() === day
      ) {
        return cell
      }
    }
  }
  return null
}

function session(
  dateStr: string,
  activity: CardioSession['activity'] = 'stair',
): Pick<CardioSession, 'date' | 'activity'> {
  return { date: `${dateStr}T08:00:00`, activity }
}

describe('buildHeatmapGrid', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 7 rows when no dates given', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15)) // Wed Apr 15 2026
    const { grid } = buildHeatmapGrid([])
    expect(grid).toHaveLength(7)
    expect(grid[0].length).toBeGreaterThanOrEqual(53)
  })

  it('grid starts on a Monday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { grid } = buildHeatmapGrid([])
    expect(grid[0][0].date.getDay()).toBe(1)
  })

  it('respects dateFrom and dateTo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 2, 1) // Mar 1
    const to = new Date(2026, 3, 15) // Apr 15
    const { grid } = buildHeatmapGrid([], from, to)
    expect(grid).toHaveLength(7)
    const cols = grid[0].length
    expect(cols).toBeGreaterThanOrEqual(7)
    expect(cols).toBeLessThanOrEqual(9)
    expect(grid[0][0].date.getTime()).toBeLessThanOrEqual(from.getTime())
  })

  it('counts sessions on the correct date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const sessions = [session('2026-04-14', 'running'), session('2026-04-14', 'walking')]
    const { grid } = buildHeatmapGrid(sessions)
    const cell = findCell(grid, 2026, 3, 14)
    expect(cell).not.toBeNull()
    expect(cell!.count).toBe(2)
    expect(cell!.types).toContain('Running')
    expect(cell!.types).toContain('Walking')
  })

  it('empty days have count 0 and no types', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2026, 3, 1)
    const to = new Date(2026, 3, 15)
    const { grid } = buildHeatmapGrid([], from, to)
    for (const row of grid) {
      for (const cell of row) {
        expect(cell.count).toBe(0)
        expect(cell.types).toEqual([])
      }
    }
  })

  it('generates month labels for visible months', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const { monthLabels } = buildHeatmapGrid([])
    expect(monthLabels.length).toBeGreaterThan(0)
    expect(monthLabels.find((l) => l.label === 'Apr')).toBeDefined()
  })

  it('does not duplicate friendly types when the same activity repeats', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const sessions = [session('2026-04-14', 'running'), session('2026-04-14', 'running')]
    const { grid } = buildHeatmapGrid(sessions)
    const cell = findCell(grid, 2026, 3, 14)
    expect(cell).not.toBeNull()
    expect(cell!.count).toBe(2)
    expect(cell!.types).toEqual(['Running'])
  })

  it('clamps dateFrom to MAX_COLS (~2 years) before dateTo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 15))
    const from = new Date(2020, 0, 1) // way too early
    const to = new Date(2026, 3, 15)
    const { grid } = buildHeatmapGrid([], from, to)
    expect(grid[0].length).toBeLessThanOrEqual(105)
  })
})

describe('intensityLevel', () => {
  it('buckets counts into 0/1/2/3', () => {
    expect(intensityLevel(0)).toBe(0)
    expect(intensityLevel(-1)).toBe(0)
    expect(intensityLevel(1)).toBe(1)
    expect(intensityLevel(2)).toBe(2)
    expect(intensityLevel(3)).toBe(3)
    expect(intensityLevel(10)).toBe(3)
  })
})
