import type { JSX } from 'react'

import {
  HEATMAP_TARGET_COL_ATTRIBUTE,
  HEATMAP_TARGET_ROW_ATTRIBUTE,
} from '@/components/training-facility/shared/charts/heatmap-targets'
import {
  type GoalTargetChange,
  describeGoalTargetChange,
  formatGoalTargetChange,
} from '@/lib/training-facility/goal-targets'

/** Props for {@link GoalChangeMarker}. */
export interface GoalChangeMarkerProps {
  /** The change being marked — supplies the `30 → 50` label and its date. */
  change: GoalTargetChange
  /** X offset, in the parent SVG's user units, of the boundary this marks. */
  x: number
  /** Y offset where the rule starts (usually the top of the plot area). */
  y: number
  /** Length of the vertical rule in user units — normally the plot height. */
  height: number
  /**
   * Stroke/text color. Defaults to a soft cream that reads on the Weight
   * Room's dark surface without competing with the data itself.
   */
  color?: string
  /**
   * Where to place the text relative to the rule. `'above'` (default) sits it
   * over the plot; `'below'` drops it under, for charts whose top edge is
   * already crowded.
   */
  labelPosition?: 'above' | 'below'
  /**
   * The heatmap cell, as `{ col, row }`, that tapping the marker selects inside a
   * `HeatmapInspector`, so touch readers can reach the change's date. Omit outside
   * an inspector.
   */
  target?: { col: number; row: number }
}

/** Soft cream that reads as chrome rather than data on the dark card. */
const MARKER_COLOR = 'rgba(247, 234, 217, 0.55)'

/**
 * A "the bar moved here" boundary marker for goal-relative charts (#362) —
 * a dashed vertical rule at the day a target changed, labelled `30 → 50`.
 *
 * Exists so a step in adherence reads as *the goal changed* rather than as a
 * mysterious cliff in the data. Deliberately generic about its geometry (it
 * takes `x` / `y` / `height` rather than dates or scales) so the rotation
 * timeline in #361, which needs the same "what I was measuring against
 * changed on this date" treatment for a *different* x-axis, can reuse it
 * without inheriting the heatmap's week-column layout.
 *
 * Renders as an SVG `<g>`; mount it inside the parent chart's `<svg>`, after
 * the data marks so the rule sits on top.
 */
export function GoalChangeMarker({
  change,
  x,
  y,
  height,
  color = MARKER_COLOR,
  labelPosition = 'above',
  target,
}: GoalChangeMarkerProps): JSX.Element {
  const labelY = labelPosition === 'above' ? y - 4 : y + height + 10
  const targetAttributes =
    target === undefined
      ? {}
      : {
          [HEATMAP_TARGET_COL_ATTRIBUTE]: target.col,
          [HEATMAP_TARGET_ROW_ATTRIBUTE]: target.row,
          style: { cursor: 'pointer' },
        }
  return (
    <g data-testid={`goal-change-${change.effective_from}`} {...targetAttributes}>
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      <text x={x + 3} y={labelY} fontSize={9} fill={color}>
        {formatGoalTargetChange(change)}
      </text>
      {/* Native tooltip carries the date, which the visible label omits to stay
          narrow enough for a one-week column. Touch readers get it from the
          target cell's details instead. */}
      <title>{`Goal ${describeGoalTargetChange(change)}`}</title>
    </g>
  )
}
