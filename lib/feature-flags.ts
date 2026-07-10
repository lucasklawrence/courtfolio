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

/**
 * True when the Draft Room panel showcase (#234 / #241) should be visible and
 * navigable. Defaults to `false` so the route 404s until the showcase is ready
 * to ship publicly (live-run data swapped in + a nav entry wired up).
 */
export function isDraftRoomEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DRAFT_ROOM === 'true'
}

/**
 * True when the Draft Room's *live* panel run (#241) is enabled: the
 * "Run it live" button and the paid `/api/panel/run` endpoint. Separate from
 * {@link isDraftRoomEnabled} so the zero-cost replay page can ship (or stay
 * up) with the paid endpoint dark — flipping this flag on is the moment the
 * abuse/cost guards go live-fire. Defaults to `false`.
 */
export function isPanelLiveEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PANEL_LIVE === 'true'
}
