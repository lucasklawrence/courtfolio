/**
 * Shared pill styling for the History view's filter controls (#438).
 *
 * The exercise chips and the heatmap range toggle render side by side, so a
 * focus ring or padding tweak applied to one and not the other is visible on
 * the same row. The *active* treatment deliberately stays with each control —
 * chips tint with the exercise's own colour, the range toggle uses the page's
 * amber accent — because that difference is the point, not drift.
 */

/** Shape, type, spacing, and focus ring shared by every filter pill. */
export const CHIP_BASE_CLASS =
  'rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300'

/** The unselected treatment, identical across both controls. */
export const CHIP_INACTIVE_CLASS = 'border-white/20 text-white/45 hover:text-white/70'
