'use client'

import { usePathname, useSearchParams } from 'next/navigation'

import { CARDIO_DEMO_DATA } from '@/constants/cardio-demo-fixture'
import type { CardioActivity, CardioData } from '@/types/cardio'

import {
  CARDIO_PREVIEW_PARAM,
  CARDIO_PREVIEW_VALUE,
  isPreviewDemoActive,
} from './preview-param'

// Re-export the URL contract constants + the cross-context predicate
// for callers that want everything from one entry point. Server
// components must NOT import these via this module — they're inside a
// `'use client'` boundary, which Next 15+ refuses to call from a
// Server Component. Import directly from `./preview-param` instead.
export { CARDIO_PREVIEW_PARAM, CARDIO_PREVIEW_VALUE, isPreviewDemoActive }

/** Optional knobs for {@link useCardioPreview}. */
export interface UseCardioPreviewOptions {
  /**
   * If provided, only sessions matching this activity count toward
   * "real data exists." Per-activity surfaces (Stair, Treadmill,
   * Track) pass their activity so the preview fires when the real DB
   * has data — just none for that activity. Cross-activity surfaces
   * (Overview, Gym landing) leave this unset; any session there
   * suppresses preview.
   */
  requireActivity?: CardioActivity
}

/** Result of {@link useCardioPreview}. */
export interface CardioPreviewState {
  /**
   * The dataset the surfaces should render. When real data exists, it
   * passes through unchanged — preview never shadows live data. When
   * the page is in preview mode, `CARDIO_DEMO_DATA` is substituted.
   * Otherwise (real data is empty AND no preview param), the original
   * value is returned so callers can still render their empty state.
   */
  data: CardioData | null | undefined
  /**
   * `true` when the URL has `?preview=demo` AND the real fetch
   * returned no sessions for the requested scope (all activities, or
   * the activity passed in `options.requireActivity`). Drives the
   * {@link PreviewModeBadge}.
   */
  isPreviewMode: boolean
  /**
   * `true` when the real fetch returned no sessions for the requested
   * scope AND no preview param is set. Drives the empty-state CTA
   * that points to `?preview=demo`.
   */
  showEmptyStateCta: boolean
}

/**
 * Centralizes the empty-state preview decision for client islands on
 * the cardio surfaces (Stair, Treadmill, Track, AllCardioOverview).
 *
 * Three branches, mutually exclusive once the real fetch has settled:
 *   - `data === undefined` → still loading (caller renders its loader)
 *   - `data` is empty + no preview param → real-empty branch
 *     (caller shows CTA + empty-state visualizations)
 *   - `data` is empty + `?preview=demo` → preview branch (caller
 *     renders fixture data + the badge)
 *   - `data.sessions.length > 0` → real data wins; preview ignored
 *
 * Preview mode is empty-state-only: a single real session in the
 * relevant scope suppresses the entire preview path. Pass
 * `options.requireActivity` on a per-activity surface to scope
 * "empty" to just that activity, so e.g. the Track page can still
 * show preview when the DB has stair sessions but no walking.
 *
 * @param real The cardio dataset returned by `getCardioData()`. Pass
 *   the raw value — `null` for "no data exists yet", a populated
 *   object for "real data", and `undefined` while still fetching.
 * @param options See {@link UseCardioPreviewOptions}.
 */
export function useCardioPreview(
  real: CardioData | null | undefined,
  options: UseCardioPreviewOptions = {},
): CardioPreviewState {
  const searchParams = useSearchParams()
  const previewActive = isPreviewDemoActive(searchParams?.get(CARDIO_PREVIEW_PARAM))
  const realIsEmpty = computeRealIsEmpty(real, options.requireActivity)
  const isPreviewMode = realIsEmpty && previewActive
  const showEmptyStateCta = realIsEmpty && !previewActive

  return {
    data: isPreviewMode ? CARDIO_DEMO_DATA : real,
    isPreviewMode,
    showEmptyStateCta,
  }
}

/**
 * Returns the href that points the empty-state CTA at "this same page,
 * with `?preview=demo`." Sourced from `usePathname()` so a future
 * route move follows along — no hardcoded paths in each surface.
 *
 * The Gym landing (server component) builds its own equivalent string
 * because `usePathname()` is client-only; the four detail islands all
 * use this helper.
 */
export function useCardioPreviewHref(): string {
  const pathname = usePathname()
  return `${pathname}?${CARDIO_PREVIEW_PARAM}=${CARDIO_PREVIEW_VALUE}`
}

/**
 * "Real data is empty for the requested scope." Tri-valued input:
 *   - `undefined` → still loading; not empty (yet)
 *   - `null` → no data exists in any table → empty
 *   - populated → empty iff the (possibly activity-filtered) sessions
 *     array has zero entries
 */
function computeRealIsEmpty(
  real: CardioData | null | undefined,
  requireActivity: CardioActivity | undefined,
): boolean {
  if (real === undefined) return false
  if (real === null) return true
  const sessions = requireActivity
    ? real.sessions.filter((s) => s.activity === requireActivity)
    : real.sessions
  return sessions.length === 0
}
