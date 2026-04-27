'use client'

import { useEffect, useState, type JSX } from 'react'
import { Scoreboard } from '@/components/training-facility/shared/Scoreboard'
import { deriveCombineScoreboardCells } from '@/components/training-facility/shared/scoreboard-utils'
import { getMovementBenchmarks } from '@/lib/data/movement'
import type { Benchmark } from '@/types/movement'

/**
 * Client island that fetches the benchmark history at runtime and
 * renders the Combine scoreboard. The data layer (`getMovementBenchmarks`)
 * uses a relative URL so the call only works on the client; isolating it
 * here keeps the parent page a server component that can do the feature
 * flag gate.
 *
 * Empty / missing data renders em-dash placeholders, the documented
 * empty state — `getMovementBenchmarks()` already returns `[]` on 404.
 */
export function CombineScoreboardSection(): JSX.Element {
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

  return <Scoreboard cells={cells} ariaLabel="Combine scoreboard summary" />
}
