'use client'

import { useCallback, useEffect, useRef, useState, type JSX } from 'react'

import { Scoreboard } from '@/components/training-facility/shared/Scoreboard'
import { deriveCombineScoreboardCells } from '@/components/training-facility/shared/scoreboard-utils'
import { getMovementBenchmarks } from '@/lib/data/movement'
import type { Benchmark } from '@/types/movement'

import { CombineEntryForm } from './CombineEntryForm'
import { CombineTradingCard } from './CombineTradingCard'

/**
 * Owns the Combine page's shared `entries` state. Renders the
 * Scoreboard (PRD §9.1), the Trading Card stat block (PRD §9.2), and
 * the dev-only entry form (PRD §7.5 view 7), all reading from the same
 * in-memory list so a saved entry shows up in every visualization
 * immediately, with no reload.
 *
 * Keeping fetch + form state co-located here lets the parent page stay
 * a server component (it does the feature-flag gate) while still
 * sharing live data across multiple client children. Future Combine
 * visualizations (Silhouette, Shuttle Trace, etc.) plug in the same
 * way — accept `entries` as a prop, render between the Scoreboard and
 * the entry form.
 *
 * Empty / missing data renders the Scoreboard with em-dash
 * placeholders, matching the documented empty state of
 * `getMovementBenchmarks()` (returns `[]` on 404). The Trading Card
 * hides itself entirely on empty/loading so the placeholders aren't
 * duplicated.
 */
export function CombineDataIsland(): JSX.Element {
  const [entries, setEntries] = useState<Benchmark[] | undefined>(undefined)
  // Monotonic request id. Both the mount-time fetch and the
  // post-save refetch increment this before issuing their request and
  // only commit results when the id is still current. Prevents a slow
  // mount-time fetch from clobbering fresh post-save data if it
  // resolves later. The mount cleanup also bumps the ref, which
  // invalidates every in-flight request after unmount so a late
  // resolver can't `setEntries` on an unmounted component.
  const requestIdRef = useRef(0)

  useEffect(() => {
    const id = ++requestIdRef.current
    getMovementBenchmarks()
      .then((data) => {
        if (id === requestIdRef.current) setEntries(data)
      })
      .catch(() => {
        if (id === requestIdRef.current) setEntries([])
      })
    return () => {
      // Bump on unmount so any pending fetch's id check fails when it
      // finally resolves — covers both the mount fetch above and any
      // post-save fetch that hasn't resolved yet.
      requestIdRef.current += 1
    }
  }, [])

  const handleSaved = useCallback(async (): Promise<void> => {
    // Bypass the HTTP cache after a write — Next dev serves the
    // static JSON from disk, but the browser may have cached the
    // pre-write copy. `no-store` guarantees the next render reflects
    // the entry the user just logged.
    const id = ++requestIdRef.current
    try {
      const data = await getMovementBenchmarks({ cache: 'no-store' })
      if (id === requestIdRef.current) setEntries(data)
    } catch {
      if (id === requestIdRef.current) setEntries([])
    }
  }, [])

  const cells = deriveCombineScoreboardCells(entries ?? [])

  return (
    <div className="flex flex-col gap-8">
      <Scoreboard cells={cells} ariaLabel="Combine scoreboard summary" />
      <CombineTradingCard entries={entries} />
      <CombineEntryForm onSaved={handleSaved} />
    </div>
  )
}
