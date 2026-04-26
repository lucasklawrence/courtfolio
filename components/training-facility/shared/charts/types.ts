export interface ChartMargin {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Shared default {@link ChartMargin} for every chart primitive — sized so
 * common axis labels fit inside the SVG without callers overriding `margin`.
 *
 * - `bottom: 52` — fits a tick row (~12px) plus an optional `xLabel`
 *   rendered at `position + 32` with a 13px font (~6px below baseline).
 * - `right: 40` — fits right-axis tick labels (text-anchor="start", values
 *   like "240" run ~24px past the spine) plus the rotated axis label, so a
 *   secondary right axis (e.g. {@link BodyweightOverlay}) renders cleanly
 *   without callers having to override `margin.right`.
 */
export const defaultMargin: ChartMargin = {
  top: 16,
  right: 40,
  bottom: 52,
  left: 56,
}

export interface ChartCommonProps {
  width: number
  height: number
  margin?: Partial<ChartMargin>
  /** Override sketchiness — 0 = clean lines, 2+ = very wobbly. */
  roughness?: number
  /** Stable seed so re-renders don't re-jitter. */
  seed?: number
  /** Font for axis labels. Defaults to `inherit` so the parent picks. */
  fontFamily?: string
  /** Stroke for axis spines, ticks, and tick labels. */
  axisColor?: string
  className?: string
  /** Accessible name for the chart. Without this, role="img" announces as an unnamed graphic. */
  ariaLabel?: string
  /** ID of an existing on-screen element that labels the chart. Use instead of ariaLabel when the title is already in the DOM. */
  ariaLabelledBy?: string
  /** Text rendered when data is empty (length === 0). Defaults to "No data". */
  emptyMessage?: string
}

export function resolveMargin(m: Partial<ChartMargin> | undefined): ChartMargin {
  return { ...defaultMargin, ...m }
}
