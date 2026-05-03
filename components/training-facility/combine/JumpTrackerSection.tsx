'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, type JSX } from 'react'
import { COMBINE_DEMO_BENCHMARKS } from '@/constants/combine-demo-fixture'
import { getMovementBenchmarks } from '@/lib/data/movement'
import {
  CARDIO_PREVIEW_PARAM,
  isPreviewDemoActive,
} from '@/lib/training-facility/preview-param'
import type { Benchmark } from '@/types/movement'
import { CeilingView } from './CeilingView'
import { SilhouetteJumpTracker } from './SilhouetteJumpTracker'

/**
 * Client island that fetches the benchmark history and renders the paired
 * silhouette tracker (PRD §9.3) + ceiling view (PRD §9.4).
 *
 * Mirrors the data-fetch pattern used by the scoreboard island: relative
 * URL fetch happens on the client so the parent page can stay a server
 * component for the feature-flag gate. A failure in the fetch falls back
 * to an empty array so each child renders its own empty state.
 *
 * Layout: stacked on mobile, side-by-side on `lg` and up. The silhouette
 * tracker takes ~2/3 of the desktop width and the ceiling gauge ~1/3,
 * matching their natural information densities.
 *
 * Empty-state preview affordance (#160 → #171): when the URL has
 * `?preview=demo` AND the real fetch settled empty, swap in the shared
 * demo fixture so the silhouette + ceiling view hydrate alongside the
 * rest of the Combine surfaces (which `CombineDataIsland` already wires
 * up). This island deliberately does NOT render its own preview badge
 * or CTA — the page-level affordance lives in `CombineDataIsland`, and
 * duplicating it here would double the chrome. A real fetch with rows
 * always wins, regardless of the URL param.
 */
export function JumpTrackerSection(): JSX.Element {
  const [entries, setEntries] = useState<Benchmark[] | undefined>(undefined)
  const searchParams = useSearchParams()
  const previewActive = isPreviewDemoActive(
    searchParams?.get(CARDIO_PREVIEW_PARAM),
  )

  useEffect(() => {
    let cancelled = false
    getMovementBenchmarks()
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch(() => {
        if (!cancelled) setEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // While the fetch is in flight (`entries === undefined`), render placeholder
  // card frames instead of `entries ?? []`. The empty array would otherwise
  // trigger each child's "no jumps logged yet" copy, flashing the empty state
  // on every page load before the data arrives.
  if (entries === undefined) {
    return (
      <section
        aria-label="Jump tracker — silhouette and ceiling view"
        aria-busy="true"
        className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]"
      >
        <div className="min-h-[300px] rounded-2xl border border-amber-300/20 bg-black/40 p-4 sm:p-6" />
        <div className="min-h-[300px] rounded-2xl border border-amber-300/20 bg-black/40 p-4 sm:p-6" />
      </section>
    )
  }

  // Preview swap: only fires when the real fetch settled empty AND the
  // URL param is active. A populated `entries` always passes through
  // unchanged so a real benchmark history is never shadowed by the demo.
  const realIsEmpty = entries.length === 0
  const isPreviewMode = realIsEmpty && previewActive
  const surfaceEntries = isPreviewMode ? COMBINE_DEMO_BENCHMARKS : entries

  return (
    <section
      aria-label="Jump tracker — silhouette and ceiling view"
      className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]"
    >
      <div className="rounded-2xl border border-amber-300/20 bg-black/40 p-4 sm:p-6">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
            Silhouette Tracker
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300/50">
            §9.3
          </span>
        </header>
        <SilhouetteJumpTracker entries={surfaceEntries} />
      </div>
      <div className="rounded-2xl border border-amber-300/20 bg-black/40 p-4 sm:p-6">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
            Ceiling View
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300/50">
            §9.4
          </span>
        </header>
        <CeilingView entries={surfaceEntries} />
      </div>
    </section>
  )
}
