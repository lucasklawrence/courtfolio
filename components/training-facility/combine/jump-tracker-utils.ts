import type { Benchmark } from '@/types/movement'

/**
 * The shape the silhouette tracker (§9.3) and ceiling view (§9.4) consume.
 * `vertical_in` is required at this layer — entries without a vertical
 * jump value can't be plotted and are filtered out upstream.
 */
export interface JumpEntry {
  /** ISO `YYYY-MM-DD` session date — used as the React key and tooltip line. */
  date: string
  /** Vertical jump in inches. Lifts the silhouette's feet above the floor. */
  verticalIn: number
  /** Bodyweight that month, when logged. Surfaced in the silhouette's hover tooltip. */
  bodyweightLbs?: number
}

/**
 * Reduce a benchmark history to the renderable jump set:
 * - Drop entries without a `vertical_in` value (nothing to plot).
 * - Drop entries explicitly marked `is_complete: false` (test sessions per PRD §7.11).
 * - Sort oldest → newest so the consumer can treat the last element as the
 *   "latest" silhouette without re-sorting.
 *
 * @param entries Raw benchmark history (may be unsorted, may contain partials).
 */
export function selectJumpEntries(entries: readonly Benchmark[]): JumpEntry[] {
  return entries
    .filter((e) => e.is_complete !== false && typeof e.vertical_in === 'number')
    .map((e) => ({
      date: e.date,
      verticalIn: e.vertical_in as number,
      bodyweightLbs: e.bodyweight_lbs,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Visual fade weight for an older silhouette in a stack. Newest = 1.0,
 * oldest = `minOpacity`, intermediate entries linearly interpolated. With
 * a single entry the result is always 1 (no fade gradient possible).
 *
 * The latest jump is special-cased by callers (rendered solid rim-orange
 * per PRD §9.3); this function is for the faded grey/cream stack behind it.
 *
 * @param index      Zero-based index into the oldest-first array (0 = oldest).
 * @param total      Total entries in the stack.
 * @param minOpacity Floor opacity for the oldest entry. Defaults to 0.25 — light
 *                   enough to feel like ghosts, dark enough to read on hardwood tan.
 */
export function freshnessOpacity(
  index: number,
  total: number,
  minOpacity = 0.25,
): number {
  if (total <= 1) return 1
  const t = index / (total - 1)
  return minOpacity + (1 - minOpacity) * t
}
