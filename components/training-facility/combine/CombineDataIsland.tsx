'use client'

import { useCallback, useEffect, useState, type JSX } from 'react'

import { Scoreboard } from '@/components/training-facility/shared/Scoreboard'
import { deriveCombineScoreboardCells } from '@/components/training-facility/shared/scoreboard-utils'
import { getMovementBenchmarks } from '@/lib/data/movement'
import type { Benchmark } from '@/types/movement'

import { CombineEntryForm } from './CombineEntryForm'

/**
 * Owns the Combine page's shared `entries` state. Renders the
 * Scoreboard (PRD §9.1) and the dev-only entry form (PRD §7.5 view 7),
 * both reading from the same in-memory list so a saved entry shows up
 * in the Scoreboard immediately, with no reload.
 *
 * Keeping fetch + form state co-located here lets the parent page stay
 * a server component (it does the feature-flag gate) while still
 * sharing live data across two client children. Future Combine
 * visualizations (Trading Card, Silhouette, etc.) plug in the same
 * way — accept `entries` as a prop, render below the Scoreboard.
 *
 * Empty / missing data renders the Scoreboard with em-dash
 * placeholders, matching the documented empty state of
 * `getMovementBenchmarks()` (returns `[]` on 404).
 */
export function CombineDataIsland(): JSX.Element {
  const [entries, setEntries] = useState<Benchmark[] | undefined>(undefined)

  const refetch = useCallback(async (cache?: RequestCache): Promise<void> => {
    try {
      const data = await getMovementBenchmarks(cache ? { cache } : undefined)
      setEntries(data)
    } catch {
      // Treat any read error the same as "no data yet" so the
      // Scoreboard still renders with em-dash placeholders rather
      // than blocking the whole page on a transient fetch failure.
      setEntries([])
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const handleSaved = useCallback(async (): Promise<void> => {
    // Bypass the HTTP cache after a write — Next dev serves the
    // static JSON from disk, but the browser may have cached the
    // pre-write copy. `no-store` guarantees the next render reflects
    // the entry the user just logged.
    await refetch('no-store')
  }, [refetch])

  const cells = deriveCombineScoreboardCells(entries ?? [])

  return (
    <div className="flex flex-col gap-8">
      <Scoreboard cells={cells} ariaLabel="Combine scoreboard summary" />
      <CombineEntryForm onSaved={handleSaved} />
    </div>
  )
}
