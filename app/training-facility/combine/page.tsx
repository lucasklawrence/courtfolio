'use client'

import { useEffect, useState, type JSX } from 'react'
import { Scoreboard } from '@/components/training-facility/shared/Scoreboard'
import { deriveCombineScoreboardCells } from '@/components/training-facility/shared/scoreboard-utils'
import { getMovementBenchmarks } from '@/lib/data/movement'
import type { Benchmark } from '@/types/movement'

/**
 * Combine sub-area page (PRD §9). The first deployment of the shared
 * scoreboard summary header (PRD §9.1) sits at the top; richer
 * visualizations (Trading Card, Silhouette, Shuttle Trace, Sprint Race,
 * Radar) land in subsequent issues.
 *
 * The page is a client component because the data layer fetches
 * `public/data/movement_benchmarks.json` at runtime via a relative URL
 * (see {@link getMovementBenchmarks}). When no benchmarks exist yet the
 * scoreboard renders em-dash placeholders, the documented empty state.
 */
export default function TrainingFacilityCombinePage(): JSX.Element {
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

  const cells = deriveCombineScoreboardCells(entries ?? [])

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,#241811_0%,#120d0a_52%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12 sm:px-8 lg:px-12">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
            Training Facility / Combine
          </p>
          <h1 className="mt-2 text-4xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            The Combine
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Tier-1 movement benchmarks: bodyweight, 5-10-5 shuttle, vertical jump, and 10-yard
            sprint. The scoreboard tracks the latest values against the first-ever entry per
            metric.
          </p>
        </header>

        <Scoreboard cells={cells} ariaLabel="Combine scoreboard summary" />
      </div>
    </main>
  )
}
