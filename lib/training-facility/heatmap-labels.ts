/**
 * Shared axis-label geometry for the Weight Room calendar heatmaps.
 *
 * Both {@link import('@/components/training-facility/weight-room/StrengthHeatmap').StrengthHeatmap}
 * and {@link import('@/components/training-facility/weight-room/FocusLaneHeatmap').FocusLaneHeatmap}
 * draw month names above a 7×N week grid at `col * cellSize`, with no
 * spacing rule. That only stays legible while months land far apart — over
 * a trailing 52 weeks they average ~4.3 columns, so the per-exercise
 * heatmap gets away with it. A grid narrow enough to put two month
 * boundaries in adjacent columns renders them on top of each other
 * (`JunJul`), which is what the focus lanes do on a fresh rotation (#370).
 */

/** A month marker on a heatmap's top axis. */
export interface HeatmapMonthLabel {
  /** Zero-based grid column the label is drawn above. */
  col: number
  /** Short month name, e.g. `"Jul"`. */
  label: string
}

/** Options for {@link thinMonthLabels}. */
export interface ThinMonthLabelsOptions {
  /** Pixel stride per grid column — the cell size including its gap. */
  cellSize: number
  /**
   * Total columns in the grid. Bounds the span of the final label, which
   * has no following marker to measure against.
   */
  totalCols: number
  /**
   * Minimum pixel gap to leave between two rendered labels. Defaults to
   * {@link DEFAULT_MIN_MONTH_LABEL_GAP}.
   */
  minGapPx?: number
}

/**
 * Default minimum spacing between month labels, in pixels. Sized for a
 * three-glyph month name at 11px (~20px of advance width) plus a little
 * air, so adjacent labels read as two words rather than one.
 */
export const DEFAULT_MIN_MONTH_LABEL_GAP = 26

/**
 * Per-character advance width as a fraction of font size, used by
 * {@link estimateTextWidth}.
 *
 * Deliberately generous for the site's sans stack: over-reserving leaves a
 * few px of whitespace, under-reserving clips a glyph.
 */
const AVG_CHAR_WIDTH_EM = 0.6

/**
 * Approximate rendered width of `text` at `fontSize`, in pixels.
 *
 * SVG text cannot be measured during a server render, so any layout that
 * has to reserve room for a label — right-edge padding so the last month
 * isn't clipped, legend column stride — estimates it instead.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * AVG_CHAR_WIDTH_EM
}

/**
 * Drop month labels that would overlap their left-hand neighbour.
 *
 * Walks the markers left to right and keeps one only when it clears the
 * last kept label by `minGapPx`. On a collision the month covering **more
 * columns** wins, so a one-column sliver at the start of the range yields
 * to the month that actually fills the grid — labelling a Jun 28 → Aug 3
 * rotation `Jul`, not `Jun`. Keeping the earlier marker unconditionally
 * would name the whole chart after its first three days.
 *
 * @param labels Month markers in ascending column order.
 * @returns The subset to render, in the same order.
 */
export function thinMonthLabels(
  labels: readonly HeatmapMonthLabel[],
  { cellSize, totalCols, minGapPx = DEFAULT_MIN_MONTH_LABEL_GAP }: ThinMonthLabelsOptions
): HeatmapMonthLabel[] {
  if (labels.length === 0) return []

  /** Columns this marker owns, up to the next marker or the grid's end. */
  const spanOf = (i: number): number =>
    (i === labels.length - 1 ? totalCols : labels[i + 1].col) - labels[i].col

  const kept: { label: HeatmapMonthLabel; span: number }[] = []
  for (let i = 0; i < labels.length; i++) {
    const entry = { label: labels[i], span: spanOf(i) }
    const prev = kept[kept.length - 1]

    if (prev === undefined || (entry.label.col - prev.label.col) * cellSize >= minGapPx) {
      kept.push(entry)
      continue
    }

    // Colliding: swap in the wider month, or drop this one. A replacement
    // only ever moves the label right, and `prev` already cleared the entry
    // before it, so the swap cannot re-collide further left.
    if (entry.span > prev.span) kept[kept.length - 1] = entry
  }

  return kept.map(k => k.label)
}

/**
 * Extra width, in pixels, a grid must reserve to the right of its last
 * column so the final month label isn't clipped mid-glyph.
 *
 * The label is anchored at its column's left edge and overhangs the grid
 * whenever it sits in one of the last columns — which is exactly where a
 * short span puts it, rendering `Aug` as `Au` (#370).
 *
 * @param labels The labels actually being rendered (post-{@link thinMonthLabels}).
 * @param cellSize Pixel stride per grid column.
 * @param gridWidth Pixel width of the cell grid itself, excluding labels.
 * @param fontSize Font size the labels are drawn at.
 */
export function monthLabelOverhang(
  labels: readonly HeatmapMonthLabel[],
  cellSize: number,
  gridWidth: number,
  fontSize: number
): number {
  const last = labels[labels.length - 1]
  if (last === undefined) return 0
  return Math.max(0, last.col * cellSize + estimateTextWidth(last.label, fontSize) - gridWidth)
}
