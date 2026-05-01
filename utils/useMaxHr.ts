import { useCallback, useEffect, useState } from 'react'

import { DEFAULT_MAX_HR } from '@/constants/hr-zones'

/**
 * `localStorage` key for the user's max heart rate. Flat top-level key so it
 * matches the existing convention (`hasSeenIntro`, `hasSeenCourtTour`) and
 * stays easy to clear from DevTools.
 */
export const MAX_HR_STORAGE_KEY = 'maxHr'

/**
 * Lower bound for an accepted max HR (BPM). Below this is unrealistic for any
 * adult athlete and is almost certainly a typo or sensor glitch.
 */
export const MIN_MAX_HR = 100

/**
 * Upper bound for an accepted max HR (BPM). Above this is unrealistic for any
 * adult athlete and is almost certainly a typo.
 */
export const MAX_MAX_HR = 230

/**
 * Coerce an arbitrary input into a valid max HR or `null`. Used on read from
 * `localStorage` and on every `setMaxHr` call so a corrupt value silently
 * falls back to the default rather than poisoning downstream TRIMP math.
 *
 * @param raw - Anything the caller hands us — number, string, or null.
 * @returns A finite integer in `[MIN_MAX_HR, MAX_MAX_HR]`, or `null` when the
 *   input is missing, non-numeric, or out of range.
 */
export function parseMaxHr(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded < MIN_MAX_HR || rounded > MAX_MAX_HR) return null
  return rounded
}

/** Return shape of {@link useMaxHr}. */
export interface UseMaxHrResult {
  /**
   * Current max HR in BPM. Returns {@link DEFAULT_MAX_HR} during SSR and
   * before the first client-side read; consumers can rely on this never being
   * `null` so chart math doesn't need a guard.
   */
  maxHr: number
  /**
   * `true` once the client-side `localStorage` read has completed. Useful for
   * UI affordances like "save" buttons that should stay disabled until the
   * persisted value is known.
   */
  ready: boolean
  /**
   * `true` when the current value came from `localStorage` (the user has
   * explicitly set one). `false` when falling back to {@link DEFAULT_MAX_HR}.
   */
  isUserSet: boolean
  /**
   * Persist a new max HR. Values outside `[MIN_MAX_HR, MAX_MAX_HR]` or
   * non-finite numbers are rejected silently; the existing value stays.
   *
   * @returns `true` if the value was saved, `false` if rejected.
   */
  setMaxHr: (value: number) => boolean
  /** Clear the persisted value; subsequent reads return {@link DEFAULT_MAX_HR}. */
  reset: () => void
}

/**
 * Read/write the user's configured max heart rate from `localStorage`.
 *
 * The hook is the single source of runtime max-HR for TRIMP/ATL/CTL. The
 * import-health preprocessor handles HR-zone classification at preprocess
 * time and is independent — see `scripts/import-health.mjs --max-hr`.
 *
 * Behavior:
 * - SSR / pre-hydration: returns {@link DEFAULT_MAX_HR}, `ready: false`.
 * - Post-hydration with no stored value: returns {@link DEFAULT_MAX_HR},
 *   `ready: true`, `isUserSet: false`.
 * - Post-hydration with a stored value: returns the parsed value,
 *   `ready: true`, `isUserSet: true`.
 * - Storage access throws (private mode, disabled cookies): falls back to
 *   {@link DEFAULT_MAX_HR}; reads/writes become no-ops.
 */
export function useMaxHr(): UseMaxHrResult {
  const [maxHr, setMaxHrState] = useState<number>(DEFAULT_MAX_HR)
  const [ready, setReady] = useState(false)
  const [isUserSet, setIsUserSet] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MAX_HR_STORAGE_KEY)
      const parsed = parseMaxHr(raw)
      if (parsed !== null) {
        setMaxHrState(parsed)
        setIsUserSet(true)
      }
    } catch {
      // Storage unavailable (private mode, disabled cookies). Fall through to
      // the default — the chart still renders, just without personalization.
    } finally {
      setReady(true)
    }
  }, [])

  const setMaxHr = useCallback((value: number): boolean => {
    const parsed = parseMaxHr(value)
    if (parsed === null) return false
    try {
      localStorage.setItem(MAX_HR_STORAGE_KEY, String(parsed))
    } catch {
      // Storage unavailable; keep the in-memory value updated so the rest of
      // the session reflects the change even if it won't survive a reload.
    }
    setMaxHrState(parsed)
    setIsUserSet(true)
    return true
  }, [])

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(MAX_HR_STORAGE_KEY)
    } catch {
      // Same fallback rationale as setMaxHr.
    }
    setMaxHrState(DEFAULT_MAX_HR)
    setIsUserSet(false)
  }, [])

  return { maxHr, ready, isUserSet, setMaxHr, reset }
}
