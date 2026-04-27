/**
 * Centralized runtime flags for unfinished or staged features.
 *
 * Keep user-facing route gates in one place so client navigation and
 * server-rendered pages stay in sync when a feature is hidden.
 */

/**
 * True when the Training Facility routes should be visible and
 * navigable. Defaults to `false` until the route family is ready to
 * ship publicly.
 */
export function isTrainingFacilityEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_TRAINING_FACILITY === 'true'
}
