'use client'

import { useEffect, useMemo, useState, type JSX } from 'react'
import { TradingCard } from '@/components/training-facility/shared/TradingCard'
import { getMovementBenchmarks } from '@/lib/data/movement'
import type { Benchmark } from '@/types/movement'

/**
 * Pick the latest *complete* entry from a benchmark history. Skips
 * entries with `is_complete === false`, matching the scoreboard's
 * behaviour in `scoreboard-utils.ts`, so an aborted/test session can't
 * become the card subject and contradict the scoreboard's "latest"
 * values. Sorts by ISO date string descending — lexicographic order
 * matches calendar order for `YYYY-MM-DD`.
 *
 * Exported so the empty / all-incomplete / populated branches are
 * testable without spinning up the full client island.
 *
 * @param entries - Full benchmark history. May be empty or contain only
 *   incomplete sessions.
 * @returns The newest complete entry, or `undefined` when none exists.
 */
export function pickLatestEntry(entries: readonly Benchmark[]): Benchmark | undefined {
  const complete = entries.filter((e) => e.is_complete !== false)
  if (complete.length === 0) return undefined
  return [...complete].sort((a, b) => b.date.localeCompare(a.date))[0]
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
