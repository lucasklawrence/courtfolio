import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MIN_MONTH_LABEL_GAP,
  estimateTextWidth,
  monthLabelOverhang,
  thinMonthLabels,
  type HeatmapMonthLabel,
} from './heatmap-labels'

/** Base grid stride used by both heatmaps. */
const CELL = 14

describe('thinMonthLabels', () => {
  it('returns an empty array for no labels', () => {
    expect(thinMonthLabels([], { cellSize: CELL, totalCols: 0 })).toEqual([])
  })

  it('keeps every label when months land far enough apart', () => {
    // A 52-week window puts months ~4.3 columns (~60px) apart — comfortably
    // clear of the 26px minimum, so the per-exercise heatmap is unaffected.
    const labels: HeatmapMonthLabel[] = [
      { col: 0, label: 'Jan' },
      { col: 5, label: 'Feb' },
      { col: 9, label: 'Mar' },
      { col: 13, label: 'Apr' },
    ]
    expect(thinMonthLabels(labels, { cellSize: CELL, totalCols: 18 })).toEqual(labels)
  })

  it('drops a one-column sliver in favour of the month that fills the grid', () => {
    // The #370 repro: a rotation starting Jun 28 renders Jun in column 0 and
    // Jul in column 1 — 14px apart, so they overlapped into "JunJul".
    const labels: HeatmapMonthLabel[] = [
      { col: 0, label: 'Jun' },
      { col: 1, label: 'Jul' },
      { col: 6, label: 'Aug' },
    ]
    expect(thinMonthLabels(labels, { cellSize: CELL, totalCols: 7 })).toEqual([
      { col: 1, label: 'Jul' },
      { col: 6, label: 'Aug' },
    ])
  })

  it('keeps the earlier label when it is the wider month', () => {
    // The tie-break is span, not position. Jul owns 5 columns and Aug only
    // the last one, so a collision resolves the other way. Forced with an
    // oversized minimum gap — at the real 26px these two clear each other.
    const labels: HeatmapMonthLabel[] = [
      { col: 0, label: 'Jul' },
      { col: 5, label: 'Aug' },
    ]
    expect(thinMonthLabels(labels, { cellSize: CELL, totalCols: 6, minGapPx: 100 })).toEqual([
      { col: 0, label: 'Jul' },
    ])
  })

  it('drops a leading sliver on a long grid, where the stride stays at base', () => {
    // A rotation starting on the last day of a month puts a one-column
    // sliver at col 0. Unlike the short-lane case this is not fixed by
    // scaling the cells up — a 30-column lane renders at the base stride,
    // so the two labels stay 14px apart and need thinning.
    const labels: HeatmapMonthLabel[] = [
      { col: 0, label: 'Jun' },
      { col: 1, label: 'Jul' },
      { col: 5, label: 'Aug' },
      { col: 9, label: 'Sep' },
    ]
    expect(thinMonthLabels(labels, { cellSize: CELL, totalCols: 30 })).toEqual([
      { col: 1, label: 'Jul' },
      { col: 5, label: 'Aug' },
      { col: 9, label: 'Sep' },
    ])
  })

  it('measures the gap in pixels, so a wider stride keeps more labels', () => {
    const labels: HeatmapMonthLabel[] = [
      { col: 0, label: 'Jun' },
      { col: 1, label: 'Jul' },
    ]
    // At 14px the two columns are 14px apart — a collision.
    expect(thinMonthLabels(labels, { cellSize: 14, totalCols: 6 })).toHaveLength(1)
    // Scaled up to 30px they clear the 26px minimum and both survive.
    expect(thinMonthLabels(labels, { cellSize: 30, totalCols: 6 })).toEqual(labels)
  })

  it('honours an explicit minGapPx', () => {
    const labels: HeatmapMonthLabel[] = [
      { col: 0, label: 'Jan' },
      { col: 5, label: 'Feb' },
    ]
    expect(thinMonthLabels(labels, { cellSize: CELL, totalCols: 10, minGapPx: 0 })).toEqual(labels)
    expect(
      thinMonthLabels(labels, { cellSize: CELL, totalCols: 10, minGapPx: 200 }),
    ).toHaveLength(1)
  })

  it('never emits two labels closer than the minimum gap', () => {
    // Every month boundary in adjacent columns — the pathological case.
    const labels: HeatmapMonthLabel[] = Array.from({ length: 8 }, (_, i) => ({
      col: i,
      label: `M${i}`,
    }))
    const kept = thinMonthLabels(labels, { cellSize: CELL, totalCols: 8 })
    for (let i = 1; i < kept.length; i++) {
      expect((kept[i].col - kept[i - 1].col) * CELL).toBeGreaterThanOrEqual(
        DEFAULT_MIN_MONTH_LABEL_GAP,
      )
    }
  })

  it('preserves ascending column order', () => {
    const labels: HeatmapMonthLabel[] = [
      { col: 0, label: 'Jun' },
      { col: 1, label: 'Jul' },
      { col: 2, label: 'Aug' },
      { col: 9, label: 'Sep' },
    ]
    const kept = thinMonthLabels(labels, { cellSize: CELL, totalCols: 12 })
    const cols = kept.map((k) => k.col)
    expect([...cols].sort((a, b) => a - b)).toEqual(cols)
  })
})

describe('monthLabelOverhang', () => {
  it('is zero when no labels are rendered', () => {
    expect(monthLabelOverhang([], CELL, 84, 11)).toBe(0)
  })

  it('is zero when the last label sits well inside the grid', () => {
    const labels: HeatmapMonthLabel[] = [{ col: 0, label: 'Jan' }]
    expect(monthLabelOverhang(labels, CELL, 52 * CELL, 11)).toBe(0)
  })

  it('reserves room for a label overhanging the final column', () => {
    // The #370 repro: "Aug" in the last column of a 6-wide grid rendered as
    // "Au" because totalWidth only accounted for cells.
    const labels: HeatmapMonthLabel[] = [{ col: 5, label: 'Aug' }]
    const overhang = monthLabelOverhang(labels, CELL, 6 * CELL, 11)
    expect(overhang).toBeGreaterThan(0)
    // 5×14 + width("Aug") − 84 = 70 + 19.8 − 84
    expect(overhang).toBeCloseTo(5.8, 5)
  })
})

describe('estimateTextWidth', () => {
  it('scales with both character count and font size', () => {
    expect(estimateTextWidth('Aug', 11)).toBeCloseTo(3 * 11 * 0.6, 5)
    expect(estimateTextWidth('', 11)).toBe(0)
    expect(estimateTextWidth('pullups', 10)).toBeGreaterThan(estimateTextWidth('dips', 10))
  })
})
