'use client'

import { useEffect, useMemo, useState, type JSX } from 'react'
import { TradingCard } from '@/components/training-facility/shared/TradingCard'
import { getMovementBenchmarks } from '@/lib/data/movement'
import type { Benchmark } from '@/types/movement'

/**
 * Pick the latest entry from a benchmark history. Sorts by ISO date string
 * descending (lexicographic order matches calendar order for `YYYY-MM-DD`).
 *
 * Exported so the empty-vs-populated branch is testable without spinning
 * up the full client island.
 *
 * @param entries - Full benchmark history. May be empty.
 * @returns The newest entry, or `undefined` when the list is empty.
 */
export function pickLatestEntry(entries: readonly Benchmark[]): Benchmark | undefined {
  if (entries.length === 0) return undefined
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]
}

/**
 * Client island that fetches the benchmark history and renders the shared
 * Trading Card (PRD §9.2) below the Combine scoreboard. Hidden entirely
 * when no entries exist — the scoreboard already surfaces the empty state,
 * so duplicating it here would be noise.
 *
 * Mirrors {@link CombineScoreboardSection} for fetch/cleanup semantics so
 * both islands stay consistent: the data layer's relative-URL fetch only
 * works on the client, and a `cancelled` flag avoids setting state after
 * the section unmounts mid-flight.
 */
export function CombineTradingCardSection(): JSX.Element | null {
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

  const latest = useMemo(() => pickLatestEntry(entries ?? []), [entries])

  if (!latest || !entries) return null

  return (
    <section aria-label="Combine trading card" className="flex justify-center">
      <TradingCard entry={latest} history={entries} />
    </section>
  )
}
