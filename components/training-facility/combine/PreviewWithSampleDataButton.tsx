'use client'

import Link from 'next/link'
import type { JSX } from 'react'

/**
 * Empty-state CTA rendered above the Combine surfaces when the page
 * has zero real benchmarks AND `?preview=demo` is *not* set (#160).
 *
 * Routes to the same page with `?preview=demo` so the data island
 * picks the URL param up via `useSearchParams()` and swaps in the
 * hand-typed fixture from `constants/combine-demo-fixture.ts`. Uses
 * `<Link>` (not a button + `router.push`) so the affordance survives
 * server-side rendering, search engines see a linkable URL, and
 * shift-click / cmd-click open in a new tab the way reviewers expect.
 *
 * Visible only when the parent `CombineDataIsland` decides the page
 * is in its "no real data" branch — once a real benchmark lands the
 * button disappears and never gates real workflows.
 */
export function PreviewWithSampleDataButton(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-200/30 bg-amber-200/5 px-5 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-200/90">
          No benchmarks logged yet
        </span>
        <span className="text-sm leading-6 text-[#e8d5be] sm:text-[15px]">
          Curious what the page looks like with data? Load a sample set to see
          every chart, scoreboard, and stat block populated.
        </span>
      </div>
      <Link
        href="/training-facility/combine?preview=demo"
        className="rounded-full border border-amber-200/45 bg-amber-200/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-50 transition hover:bg-amber-200/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200/70"
      >
        Preview with sample data →
      </Link>
    </div>
  )
}
