'use client'

import { useEffect, useState, type JSX } from 'react'
import { getMovementBenchmarks } from '@/lib/data/movement'
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
 */
export function JumpTrackerSection(): JSX.Element {
  const [entries, setEntries] = useState<Benchmark[] | undefined>(undefined)

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

  const data = entries ?? []

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
        <SilhouetteJumpTracker entries={data} />
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
        <CeilingView entries={data} />
      </div>
    </section>
  )
}
