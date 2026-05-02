'use client'

import Link from 'next/link'
import type { JSX } from 'react'

/** Props for {@link PreviewWithSampleDataButton}. */
export interface PreviewWithSampleDataButtonProps {
  /**
   * Href the button navigates to. Should be the current page path with
   * `?preview=demo` appended; the data island reads `useSearchParams()`
   * and swaps in the hand-typed fixture from there. The href is the
   * URL the link visibly points at, so cmd-click / shift-click open
   * the preview in a new tab the way reviewers expect.
   */
  href: string
  /**
   * Eyebrow line above the description. Defaults to the Combine
   * wording; cardio surfaces pass a cardio-specific message.
   */
  headline?: string
  /**
   * Plain-words sentence below the eyebrow. Defaults to the Combine
   * wording; cardio surfaces pass a cardio-specific message.
   */
  description?: string
}

/**
 * Empty-state CTA rendered above a Training Facility surface when the
 * page has zero real data AND `?preview=demo` is *not* set (#160 for
 * Combine, #162 for cardio).
 *
 * Routes to the same page with `?preview=demo` so the data island
 * picks the URL param up via `useSearchParams()` and swaps in the
 * hand-typed fixture. Uses `<Link>` (not a button + `router.push`) so
 * the affordance survives server-side rendering, search engines see a
 * linkable URL, and shift-click / cmd-click open in a new tab the way
 * reviewers expect.
 *
 * Visible only when the parent decides the page is in its "no real
 * data" branch — once a real entry lands the button disappears and
 * never gates real workflows.
 */
export function PreviewWithSampleDataButton({
  href,
  headline,
  description,
}: PreviewWithSampleDataButtonProps): JSX.Element {
  const eyebrow = headline ?? 'No benchmarks logged yet'
  const message =
    description ??
    'Curious what the page looks like with data? Load a sample set to see every chart, scoreboard, and stat block populated.'

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-200/30 bg-amber-200/5 px-5 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-200/90">
          {eyebrow}
        </span>
        <span className="text-sm leading-6 text-[#e8d5be] sm:text-[15px]">{message}</span>
      </div>
      <Link
        href={href}
        className="rounded-full border border-amber-200/45 bg-amber-200/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-50 transition hover:bg-amber-200/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
      >
        Preview with sample data →
      </Link>
    </div>
  )
}
