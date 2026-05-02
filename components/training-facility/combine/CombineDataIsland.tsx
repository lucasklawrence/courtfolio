'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'

import { Scoreboard } from '@/components/training-facility/shared/Scoreboard'
import { deriveCombineScoreboardCells } from '@/components/training-facility/shared/scoreboard-utils'
import { COMBINE_DEMO_BENCHMARKS } from '@/constants/combine-demo-fixture'
import { useAdminSession } from '@/lib/auth/use-admin-session'
import {
  deleteBenchmark,
  getMovementBenchmarks,
  updateBenchmark,
} from '@/lib/data/movement'
import type { Benchmark } from '@/types/movement'

import { CombineEntryForm } from './CombineEntryForm'
import { CombineHistoryTable } from './CombineHistoryTable'
import { CombineRadar } from './CombineRadar'
import { CombineTradingCard } from './CombineTradingCard'
import { PreviewModeBadge } from './PreviewModeBadge'
import { PreviewWithSampleDataButton } from './PreviewWithSampleDataButton'
import { ShuttleTrace } from './ShuttleTrace'
import { SprintRace } from './SprintRace'

/** URL param value that activates the empty-state demo fixture (#160). */
const PREVIEW_DEMO = 'demo'

/**
 * Owns the Combine page's shared `entries` state and edit/delete
 * orchestration. Renders the Scoreboard (PRD §9.1), the Trading Card
 * stat block (PRD §9.2), the Shuttle Trace (PRD §9.5), the Sprint Race
 * (PRD §9.6), the Radar (PRD §9.7), the dev-only entry form (PRD §7.5
 * view 7), and the benchmark history table with per-row CRUD controls
 * (PRD §7.5 view 8 + §7.11),
 * all reading from the same in-memory list so a write anywhere (log,
 * edit, delete, mark-incomplete) shows up in every surface
 * immediately, with no reload.
 *
 * Keeping the form + history state co-located here is what makes the
 * Edit flow possible: clicking Edit on a history row stashes the entry
 * as `editingEntry`, the form effect picks that up to prefill and
 * lock the date input, and a successful PUT clears `editingEntry` so
 * the panel returns to log-a-session resting state.
 *
 * Other Combine visualizations live in their own islands
 * (e.g. {@link JumpTrackerSection}) and fetch independently — they
 * don't need to share write state with the form.
 *
 * Empty / missing data renders the Scoreboard with em-dash placeholders
 * and the history table with its empty state, matching the documented
 * empty-state behavior of `getMovementBenchmarks()` (returns `[]` on
 * 404). The Trading Card hides itself entirely on empty/loading so the
 * placeholders aren't duplicated.
 */
export function CombineDataIsland(): JSX.Element {
  const [entries, setEntries] = useState<Benchmark[] | undefined>(undefined)
  const [editingEntry, setEditingEntry] = useState<Benchmark | undefined>(undefined)
  // Monotonic request id. Both the mount-time fetch and the
  // post-write refetch increment this before issuing their request and
  // only commit results when the id is still current. Prevents a slow
  // mount-time fetch from clobbering fresh post-write data if it
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

  const refetch = useCallback(async (): Promise<void> => {
    // Supabase JS issues a fresh PostgREST request on every `select()`
    // call — there's no client-side cache layer to bust. The
    // request-id ref still matters for the slow-mount race covered by
    // the existing tests.
    const id = ++requestIdRef.current
    try {
      const data = await getMovementBenchmarks()
      if (id === requestIdRef.current) setEntries(data)
    } catch {
      if (id === requestIdRef.current) setEntries([])
    }
  }, [])

  const handleEdit = useCallback((entry: Benchmark): void => {
    setEditingEntry(entry)
  }, [])

  const handleCancelEdit = useCallback((): void => {
    setEditingEntry(undefined)
  }, [])

  const handleDelete = useCallback(
    async (entry: Benchmark): Promise<void> => {
      // Native confirm() is intentional (PRD §7.11 spec wording, dev-only
      // single-user UI). If a richer modal lands later it should keep
      // this exact copy.
      const ok = window.confirm(
        `Delete benchmark from ${entry.date}? This cannot be undone.`,
      )
      if (!ok) return
      try {
        await deleteBenchmark(entry.date)
      } catch (err) {
        // Surface the failure in dev console; the row stays visible
        // because the refetch below will reflect on-disk truth.
        console.error('Failed to delete benchmark:', err)
      }
      // If the deleted row was being edited, drop edit mode so the form
      // doesn't try to PUT against a date that no longer exists.
      setEditingEntry((current) =>
        current && current.date === entry.date ? undefined : current,
      )
      await refetch()
    },
    [refetch],
  )

  const handleToggleComplete = useCallback(
    async (entry: Benchmark): Promise<void> => {
      // PRD §7.11: omitted = complete (default). The "complete" branch
      // we send is the negation of the entry's current effective state.
      const currentlyComplete = entry.is_complete !== false
      try {
        await updateBenchmark(entry.date, { is_complete: !currentlyComplete })
      } catch (err) {
        console.error('Failed to toggle benchmark completeness:', err)
      }
      await refetch()
    },
    [refetch],
  )

  // Empty-state preview affordance (#160). When the real fetch settled
  // empty, surface either the "Preview with sample data" CTA (no param)
  // or the demo fixture + "Preview — sample data" badge (param set).
  // A real fetch with rows always wins — preview mode is empty-state-
  // only and never shadows live data.
  const searchParams = useSearchParams()
  const previewParam = searchParams?.get('preview')
  const realIsEmpty = entries !== undefined && entries.length === 0
  const isPreviewMode = realIsEmpty && previewParam === PREVIEW_DEMO
  const showEmptyStateCta = realIsEmpty && previewParam !== PREVIEW_DEMO

  // The entries threaded into the surfaces. `useMemo` keeps the
  // reference stable across renders so children that key off-shape
  // (Radar, ShuttleTrace, SprintRace) don't re-animate when only an
  // unrelated state slice changes.
  const surfaceEntries = useMemo(
    () => (isPreviewMode ? COMBINE_DEMO_BENCHMARKS : entries),
    [isPreviewMode, entries],
  )

  const cells = deriveCombineScoreboardCells(surfaceEntries ?? [])
  const { isAdmin } = useAdminSession()

  return (
    <div className="flex flex-col gap-10">
      {isPreviewMode ? <PreviewModeBadge /> : null}
      {showEmptyStateCta ? <PreviewWithSampleDataButton /> : null}
      <Scoreboard cells={cells} ariaLabel="Combine scoreboard summary" />
      <CombineTradingCard entries={surfaceEntries} />
      <ShuttleTrace entries={surfaceEntries} />
      <SprintRace entries={surfaceEntries} />
      <CombineRadar entries={surfaceEntries} />
      <CombineEntryForm
        onSaved={refetch}
        editingEntry={editingEntry}
        onCancelEdit={handleCancelEdit}
      />
      <CombineHistoryTable
        entries={surfaceEntries ?? []}
        showActions={isAdmin && !isPreviewMode}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleComplete={handleToggleComplete}
      />
    </div>
  )
}
