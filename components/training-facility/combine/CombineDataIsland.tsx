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

  // Mount-time fetch is wrapped with a `cancelled` flag so a fast
  // unmount (page navigation) doesn't `setEntries` on an unmounted
  // component. The post-save refetch below uses the same `setEntries`
  // but is keyed off a user gesture from a still-mounted form, so it
  // doesn't need the same guard.
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

  const handleSaved = useCallback(async (): Promise<void> => {
    // Bypass the HTTP cache after a write — Next dev serves the
    // static JSON from disk, but the browser may have cached the
    // pre-write copy. `no-store` guarantees the next render reflects
    // the entry the user just logged.
    try {
      const data = await getMovementBenchmarks({ cache: 'no-store' })
      setEntries(data)
    } catch {
      setEntries([])
    }
  }, [])

  const cells = deriveCombineScoreboardCells(entries ?? [])

  return (
    <div className="flex flex-col gap-8">
      <Scoreboard cells={cells} ariaLabel="Combine scoreboard summary" />
      <CombineEntryForm onSaved={handleSaved} />
    </div>
  )
}
