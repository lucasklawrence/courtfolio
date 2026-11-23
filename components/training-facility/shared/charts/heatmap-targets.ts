/**
 * Attributes an annotation drawn over a heatmap, such as a goal-change marker,
 * carries to name the cell that tapping it selects inside a `HeatmapInspector`,
 * so a touch reader can open the annotation's day.
 *
 * Kept out of the `'use client'` inspector module so Server Components that draw
 * the annotations can import real strings rather than client references.
 */
export const HEATMAP_TARGET_COL_ATTRIBUTE = 'data-heatmap-target-col'

/** Row half of {@link HEATMAP_TARGET_COL_ATTRIBUTE}. */
export const HEATMAP_TARGET_ROW_ATTRIBUTE = 'data-heatmap-target-row'
