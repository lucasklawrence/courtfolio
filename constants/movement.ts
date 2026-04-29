/**
 * Anatomical / court-geometry constants used by the Combine signature
 * visualizations (PRD §9.3 silhouette tracker, §9.4 ceiling view).
 *
 * The two views share a vertical axis denominated in inches above the
 * floor. Holding the anchor numbers in one place keeps the silhouette
 * tracker's standing-reach line, the ceiling view's bar, and any future
 * rim-touch calculations from drifting apart.
 */

/**
 * Generic v1 standing reach in inches — the height a fingertip touches
 * with feet flat on the floor and one arm extended overhead. Used as the
 * anchor for the silhouette's standing pose, the dashed standing-reach
 * line in §9.3, and the floor-relative jump-touch math in §9.4.
 *
 * 80" approximates a ~6'1" build. Promote to a per-user profile field
 * once the v2 multi-tenant data model lands (PRD §11.1).
 */
export const STANDING_REACH_IN = 80

/** Regulation rim height in inches (10 ft). The §9.4 ceiling view's milestone target. */
export const RIM_HEIGHT_IN = 120

/**
 * Compute jump-touch reach — the height a fingertip touches at the apex
 * of a vertical jump — from a `vertical_in` benchmark value. Returns
 * `undefined` when the jump value is missing so callers can defer to an
 * empty state rather than rendering a phantom bar at standing reach.
 *
 * @param verticalIn      Vertical jump in inches (jump-touch minus standing reach).
 * @param standingReachIn Standing reach in inches; defaults to {@link STANDING_REACH_IN}.
 */
export function jumpTouchInches(
  verticalIn: number | undefined,
  standingReachIn: number = STANDING_REACH_IN,
): number | undefined {
  return typeof verticalIn === 'number' ? standingReachIn + verticalIn : undefined
}

/**
 * Inches between the latest jump-touch and the rim. Clamped at zero so
 * the view never shows a negative gap — a negative value means rim has
 * been reached and is reframed as the celebration milestone instead.
 *
 * @param jumpTouchIn   Latest jump-touch reach in inches, or `undefined` for no data.
 * @param rimHeightIn   Rim height in inches; defaults to {@link RIM_HEIGHT_IN}.
 */
export function inchesToRim(
  jumpTouchIn: number | undefined,
  rimHeightIn: number = RIM_HEIGHT_IN,
): number | undefined {
  if (typeof jumpTouchIn !== 'number') return undefined
  return Math.max(0, rimHeightIn - jumpTouchIn)
}
