'use client'

import { usePathname, useRouter } from 'next/navigation'
import type { JSX } from 'react'

/** Props for {@link PreviewModeBadge}. */
export interface PreviewModeBadgeProps {
  /**
   * Plain-words sentence shown to the right of the "Preview — sample
   * data" eyebrow. Defaults to the Combine wording referring to
   * benchmarks; cardio surfaces pass a cardio-specific message.
   */
  description?: string
}

/**
 * Visible "Preview — sample data" chip rendered above a Training
 * Facility surface while `?preview=demo` is in the URL and the real
 * fetch returned no data (#160 for Combine, #162 for cardio). Three
 * purposes:
 *
 *   1. Make sure a viewer never mistakes the demo numbers for real
 *      ones — the badge sits prominently above every chart and reads
 *      "Preview — sample data" in plain words, no jargon.
 *   2. Provide an "Exit preview" affordance that strips the URL param
 *      via `router.replace` and returns the page to its empty-state
 *      branch.
 *   3. Style cue: amber-warm chip with a dashed border, distinct from
 *      the page's solid amber accents (e.g. the eyebrow / tier-1
 *      labels) so the visual treatment doesn't look like core UI.
 *
 * The exit URL is built from `usePathname()` rather than hardcoded, so
 * a future route move is a single `app/` rename and the badge follows
 * along — and so this single component can serve both `/combine` and
 * the `/gym` family without per-route variants.
 */
export function PreviewModeBadge({ description }: PreviewModeBadgeProps = {}): JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const message =
    description ?? "These numbers are illustrative — not Lucas’s real benchmarks."

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-dashed border-amber-300/45 bg-amber-200/8 px-5 py-3 text-amber-100 sm:justify-start"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-200/95">
        Preview — sample data
      </span>
      <span className="hidden text-amber-100/55 sm:inline" aria-hidden="true">
        ·
      </span>
      <span className="text-[13px] leading-5 text-amber-50/85">{message}</span>
      <button
        type="button"
        onClick={() => {
          // Drop just the `preview` param; preserve any future siblings
          // a caller might add. `router.replace` so the back button
          // doesn't re-enter preview mode after dismissal. `pathname`
          // (rather than a hardcoded path) keeps the badge route-agnostic
          // if the page ever moves.
          router.replace(pathname)
        }}
        className="ml-auto rounded-full border border-amber-200/45 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100 transition hover:bg-amber-200/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
      >
        Exit preview
      </button>
    </div>
  )
}
