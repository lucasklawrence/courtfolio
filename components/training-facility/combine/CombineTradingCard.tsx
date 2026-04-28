'use client'

import { type JSX } from 'react'

import { TradingCard } from '@/components/training-facility/shared/TradingCard'
import type { Benchmark } from '@/types/movement'

/** Props for {@link CombineTradingCard}. */
export interface CombineTradingCardProps {
  /**
   * Benchmark history shared with the rest of the Combine page (typically
   * fed from {@link CombineDataIsland}). `undefined` while the initial
   * fetch is in flight; an empty array means no entries are logged.
   */
  entries: Benchmark[] | undefined
}

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
  let latest: Benchmark | undefined
  for (const entry of entries) {
    if (entry.is_complete === false) continue
    if (!latest || entry.date.localeCompare(latest.date) > 0) latest = entry
  }
  return latest
}

/**
 * Combine-page wrapper around the shared {@link TradingCard} (PRD §9.2).
 * Plugs into {@link CombineDataIsland}'s shared `entries` state so the
 * card's "latest" stays in sync with the Scoreboard and reflects new
 * sessions logged via the entry form with no reload.
 *
 * Renders nothing while the initial fetch is in flight (`entries`
 * undefined) or when no complete entry exists — the Scoreboard already
 * surfaces the empty state, so duplicating it here would be noise.
 *
 * @param props.entries - Shared benchmark history. `undefined` ⇒ initial
 *   fetch is still in flight (renders nothing); `[]` ⇒ fetch completed
 *   but no entries logged (renders nothing); populated ⇒ wrapper picks
 *   the newest complete entry as the card subject and passes the full
 *   list as history.
 */
export function CombineTradingCard({ entries }: CombineTradingCardProps): JSX.Element | null {
  if (!entries) return null
  const latest = pickLatestEntry(entries)
  if (!latest) return null

  return (
    <section aria-label="Combine trading card" className="flex justify-center">
      <TradingCard entry={latest} history={entries} />
    </section>
  )
}
