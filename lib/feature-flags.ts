/**
 * Centralized runtime flags for unfinished or staged features.
 *
 * Keep user-facing route gates in one place so client navigation and
 * server-rendered pages stay in sync when a feature is hidden.
 */

/**
 * True when the Training Facility's *shared* surfaces should be visible: the
 * lobby (`/training-facility`) and the Combine. Defaults to `false`.
 *
 * Scope narrowed in #345. The Gym and Weight Room used to ride on this flag
 * too, but they became publishable before the lobby corridor and the Combine
 * did, so each got its own gate — see {@link isGymEnabled} and
 * {@link isWeightRoomEnabled}. This flag now answers "is the room-to-room
 * navigation ready?", which is also why the court's tunnel entry and the
 * Gym's door to the Combine hang off it: both point at surfaces it gates.
 */
export function isTrainingFacilityEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_TRAINING_FACILITY === 'true'
}

/**
 * True when the Gym routes (`/training-facility/gym/**` — cardio detail views,
 * OrangeTheory, HR-zone reconciliation) should be visible. Defaults to `false`.
 *
 * Split from {@link isTrainingFacilityEnabled} in #345 so the cardio surfaces
 * could ship while the lobby and Combine stayed dark.
 */
export function isGymEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_TF_GYM === 'true'
}

/**
 * True when the Weight Room routes (`/training-facility/weight-room/**` —
 * Today, History, Trophy Room, plus the admin Log and Settings) should be
 * visible. Defaults to `false`.
 *
 * Split from {@link isTrainingFacilityEnabled} in #345. Note this gates
 * *route visibility* only — the admin-only sub-routes keep their own
 * `requireAdminPage()` check on top.
 */
export function isWeightRoomEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_TF_WEIGHT_ROOM === 'true'
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
