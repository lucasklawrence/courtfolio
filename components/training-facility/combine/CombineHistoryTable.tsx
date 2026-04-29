'use client'

import { useId, useMemo, type JSX } from 'react'

import { BENCHMARKS } from '@/constants/benchmarks'
import { SCOREBOARD_METRIC_ORDER } from '@/components/training-facility/shared/scoreboard-utils'
import type { Benchmark } from '@/types/movement'

/**
 * Determine whether a benchmark counts as "complete" for the purposes
 * of trend exclusion. PRD §7.11 says omitted = complete (the default);
 * `is_complete: false` is the explicit "test/incomplete" flag. Anything
 * else (true or unset) is complete.
 */
function isComplete(entry: Benchmark): boolean {
  return entry.is_complete !== false
}

/** Props for {@link CombineHistoryTable}. */
export interface CombineHistoryTableProps {
  /**
   * Benchmark history to render. Sort order is computed inside the
   * component (newest first by date), so callers can pass the raw list
   * straight from the data layer.
   */
  entries: readonly Benchmark[]
  /**
   * When true, render the per-row Edit / Mark-incomplete / Delete
   * controls (PRD §7.11). The data island flips this on under
   * `NODE_ENV === 'development'`; production renders a read-only table.
   */
  showActions?: boolean
  /**
   * Called when the user clicks the row's Edit button. Parent should
   * stash the entry as the form's `editingEntry` prop so the panel
   * prefills and submits as an overwrite (PUT).
   */
  onEdit?: (entry: Benchmark) => void
  /**
   * Called when the user confirms a row delete. Parent is responsible
   * for any confirmation prompt (the data island uses native
   * `window.confirm()`) and for refetching after the API call.
   */
  onDelete?: (entry: Benchmark) => void
  /**
   * Called when the user clicks Mark-incomplete / Mark-complete. Parent
   * flips the row's `is_complete` flag via the data layer and refetches.
   */
  onToggleComplete?: (entry: Benchmark) => void
}

/**
 * Full benchmark history table for the Combine page (PRD §7.5 view 8 +
 * §7.11). Pure presentational: takes the entries list and per-row action
 * callbacks, sorts newest-first, renders a horizontally scrollable table
 * with one row per session.
 *
 * Rows flagged `is_complete: false` are visually dimmed and carry an
 * `INCOMPLETE` chip in the status column — they remain visible (per
 * §7.11) but the scoreboard utilities already exclude them from trend
 * calculations, so no extra filtering happens here.
 *
 * Action buttons render only when `showActions` is true so the same
 * component can be used as a read-only history surface in production.
 */
export function CombineHistoryTable({
  entries,
  showActions = false,
  onEdit,
  onDelete,
  onToggleComplete,
}: CombineHistoryTableProps): JSX.Element {
  const headingId = useId()
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.date < b.date) return 1
        if (a.date > b.date) return -1
        return 0
      }),
    [entries],
  )

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-white/10 bg-black/40 p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80"
        >
          Benchmark history
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
          {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="mt-4 font-mono text-[12px] text-white/50">
          No entries logged yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Date
                </th>
                {SCOREBOARD_METRIC_ORDER.map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className="py-2 pr-3 text-right font-medium"
                  >
                    {BENCHMARKS[key].shortLabel}
                  </th>
                ))}
                <th scope="col" className="py-2 pr-3 font-medium">
                  Notes
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Status
                </th>
                {showActions && (
                  <th scope="col" className="py-2 font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <HistoryRow
                  key={entry.date}
                  entry={entry}
                  showActions={showActions}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleComplete={onToggleComplete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

interface HistoryRowProps {
  entry: Benchmark
  showActions: boolean
  onEdit?: (entry: Benchmark) => void
  onDelete?: (entry: Benchmark) => void
  onToggleComplete?: (entry: Benchmark) => void
}

function HistoryRow({
  entry,
  showActions,
  onEdit,
  onDelete,
  onToggleComplete,
}: HistoryRowProps): JSX.Element {
  const complete = isComplete(entry)

  return (
    <tr
      data-testid={`history-row-${entry.date}`}
      data-incomplete={complete ? undefined : 'true'}
      className={`border-b border-white/5 last:border-b-0 align-top ${
        complete ? '' : 'opacity-60'
      }`}
    >
      <td className="py-2 pr-3 font-mono text-[12px] text-white/80">
        {entry.date}
      </td>
      {SCOREBOARD_METRIC_ORDER.map((key) => {
        const value = entry[key]
        const spec = BENCHMARKS[key]
        return (
          <td
            key={key}
            className="py-2 pr-3 text-right font-mono text-[12px] tabular-nums text-white/80"
          >
            {typeof value === 'number'
              ? `${value.toFixed(spec.precision)}${spec.unit}`
              : '—'}
          </td>
        )
      })}
      <td className="py-2 pr-3 max-w-[18rem] text-[12px] text-white/70">
        {entry.notes ? (
          <span className="line-clamp-2 whitespace-pre-line break-words">
            {entry.notes}
          </span>
        ) : (
          <span className="text-white/30">—</span>
        )}
      </td>
      <td className="py-2 pr-3">
        {complete ? (
          <span className="text-white/30">—</span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-rose-300/40 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-rose-200">
            Incomplete
          </span>
        )}
      </td>
      {showActions && (
        <td className="py-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEdit?.(entry)}
              aria-label={`Edit benchmark from ${entry.date}`}
              className="rounded border border-amber-300/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-200 hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onToggleComplete?.(entry)}
              aria-label={
                complete
                  ? `Mark benchmark from ${entry.date} as incomplete`
                  : `Mark benchmark from ${entry.date} as complete`
              }
              className="rounded border border-white/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {complete ? 'Mark incomplete' : 'Mark complete'}
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(entry)}
              aria-label={`Delete benchmark from ${entry.date}`}
              className="rounded border border-rose-300/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-rose-200 hover:bg-rose-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              Delete
            </button>
          </div>
        </td>
      )}
    </tr>
  )
}
