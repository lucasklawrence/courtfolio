'use client'

import { useSearchParams } from 'next/navigation'

import { CARDIO_DEMO_DATA } from '@/constants/cardio-demo-fixture'
import type { CardioData } from '@/types/cardio'

/** URL param value that activates the empty-state demo fixture (#162). */
export const CARDIO_PREVIEW_PARAM = 'preview'
export const CARDIO_PREVIEW_VALUE = 'demo'

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
   * returned no sessions. Drives the {@link PreviewModeBadge}.
   */
  isPreviewMode: boolean
  /**
   * `true` when the real fetch returned no sessions AND no preview
   * param is set. Drives the empty-state CTA that points to
   * `?preview=demo`.
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
 * Preview mode is empty-state-only: a single real session anywhere in
 * the dataset suppresses the entire preview path. That matches the
 * Combine sibling (#160) and prevents an admin from confusing demo
 * data with their own.
 *
 * @param real The cardio dataset returned by `getCardioData()`. Pass
 *   the raw value — `null` for "no data exists yet", a populated
 *   object for "real data", and `undefined` while still fetching.
 */
export function useCardioPreview(real: CardioData | null | undefined): CardioPreviewState {
  const searchParams = useSearchParams()
  const previewParam = searchParams?.get(CARDIO_PREVIEW_PARAM)
  // `real === undefined` keeps the loader branch for callers that
  // still distinguish loading from empty (e.g. StairDetailView's
  // `Loading cardio data…` panel). Once it resolves to either a
  // populated object or `null`/empty, we make the preview decision.
  const realIsEmpty =
    real === null || (real !== undefined && real.sessions.length === 0)
  const isPreviewMode = realIsEmpty && previewParam === CARDIO_PREVIEW_VALUE
  const showEmptyStateCta = realIsEmpty && previewParam !== CARDIO_PREVIEW_VALUE

  return {
    data: isPreviewMode ? CARDIO_DEMO_DATA : real,
    isPreviewMode,
    showEmptyStateCta,
  }
}
