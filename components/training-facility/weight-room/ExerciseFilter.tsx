'use client'

import { useCallback, useMemo, type JSX, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  EXERCISE_FILTER_PARAM,
  parseExerciseSelection,
  serializeExerciseSelection,
  toggleExercise,
} from '@/lib/training-facility/exercise-filter'

/** One selectable exercise, in render order. */
export interface FilterableExercise {
  /** Exercise name; the chip label and the URL token. */
  exercise: string
  /** Hex accent from the goal, used to tint the chip when selected. */
  color: string
  /** Whether this is a "grease the groove" focus anchor rather than a permanent goal. */
  isFocus: boolean
}

/** One filterable block of already-rendered page content. */
export interface FilterableSection {
  /** Exercise this block belongs to; matched against the selection. */
  exercise: string
  /** Server-rendered content — heatmap, weekly volume, variant breakdown, … */
  node: ReactNode
}

/** Props for {@link ExerciseFilter}. */
export interface ExerciseFilterProps {
  /** Every exercise offering a chip, in render order. */
  exercises: readonly FilterableExercise[]
  /**
   * Per-exercise page blocks. Rendered on the server and passed through as
   * nodes, so filtering costs no client-side chart work — the SVGs are already
   * built by the time this component decides whether to show them.
   */
  sections: readonly FilterableSection[]
  /**
   * Stats cards for the selected exercises, keyed the same way. Separate from
   * {@link sections} because the stats panel is one grid across exercises
   * rather than a stack of independent blocks.
   */
  statsSections: readonly FilterableSection[]
  /** Heading rendered above the stats grid, inside the filtered region. */
  statsHeading: ReactNode
  /**
   * Unfiltered content rendered between the per-exercise blocks and the stats
   * grid — the relative-strength chart, which sits there in the page's reading
   * order.
   *
   * It exists as a slot rather than being left in the page because the two
   * filtered regions surround it; without this the page would have to reorder
   * to keep them contiguous. Deliberately *not* filtered: like the GTG section
   * and the stitched focus lanes, it's a featured cross-cutting chart rather
   * than per-exercise detail.
   */
  afterSections?: ReactNode
}

/**
 * Exercise toggle chips for the History view (#367), plus the filtered
 * content they control.
 *
 * **Why the content lives inside this component.** The History page is a
 * Server Component and is statically prerendered. Reading the filter from
 * `searchParams` on the *page* would opt the whole route into dynamic
 * rendering just to hide a few sections. Instead the server renders every
 * exercise's blocks unconditionally and hands them here as nodes; this island
 * reads the URL client-side and chooses which to mount. The route stays
 * static, the selection stays linkable, and no chart is rebuilt in the
 * browser.
 *
 * Must be wrapped in a `<Suspense>` boundary by the caller — `useSearchParams`
 * forces a client bailout otherwise, which Next refuses inside a statically
 * prerendered route.
 *
 * The GTG rotation section and the stitched focus-lane heatmaps are
 * deliberately *not* filtered: those are the rotation's own cross-exercise
 * story, and slicing a stitched lane by exercise would defeat the point of
 * stitching it.
 */
export function ExerciseFilter({
  exercises,
  sections,
  statsSections,
  statsHeading,
  afterSections,
}: ExerciseFilterProps): JSX.Element {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const available = useMemo(() => exercises.map((e) => e.exercise), [exercises])
  const selected = useMemo(
    () => parseExerciseSelection(searchParams.get(EXERCISE_FILTER_PARAM), available),
    [searchParams, available],
  )
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const applySelection = useCallback(
    (next: readonly string[]) => {
      const params = new URLSearchParams(searchParams.toString())
      const encoded = serializeExerciseSelection(next, available)
      if (encoded === null) params.delete(EXERCISE_FILTER_PARAM)
      else params.set(EXERCISE_FILTER_PARAM, encoded)
      const query = params.toString()
      // `replace`, not `push`: toggling a chip is a view preference, not a
      // navigation step — stacking them would make Back walk the whole
      // toggle history instead of leaving the page. `scroll: false` keeps
      // the reader where they were in a long page.
      router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false })
    },
    [available, pathname, router, searchParams],
  )

  const visibleSections = sections.filter((s) => selectedSet.has(s.exercise))
  const visibleStats = statsSections.filter((s) => selectedSet.has(s.exercise))
  const allSelected = selected.length === available.length

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-2" data-testid="exercise-filter">
        <span
          id="exercise-filter-label"
          className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300/70"
        >
          Show
        </span>
        <div role="group" aria-labelledby="exercise-filter-label" className="flex flex-wrap gap-2">
          {exercises.map(({ exercise, color, isFocus }) => {
            const isOn = selectedSet.has(exercise)
            return (
              <button
                key={exercise}
                type="button"
                aria-pressed={isOn}
                data-testid={`exercise-chip-${exercise}`}
                onClick={() => applySelection(toggleExercise(selected, exercise, available))}
                className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                  isOn
                    ? 'border-transparent text-[#0a0a0a]'
                    : 'border-white/20 text-white/45 hover:text-white/70'
                }`}
                style={isOn ? { backgroundColor: color } : undefined}
              >
                {exercise}
                {isFocus ? <span className="ml-1.5 opacity-70">GTG</span> : null}
              </button>
            )
          })}
        </div>
        {!allSelected ? (
          <button
            type="button"
            data-testid="exercise-chip-reset"
            onClick={() => applySelection(available)}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 underline underline-offset-4 hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            show all
          </button>
        ) : null}
      </div>

      {selected.length === 0 ? (
        <p
          data-testid="exercise-filter-empty"
          className="mt-10 rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
        >
          No exercises selected — pick one above to see its heatmap and stats.
        </p>
      ) : (
        <section
          aria-label="Per-exercise heatmaps"
          data-testid="weight-room-heatmaps"
          className="mt-10 space-y-8"
        >
          {visibleSections.map(({ exercise, node }) => (
            <div key={exercise}>{node}</div>
          ))}
        </section>
      )}

      {/* Outside the empty-state branch on purpose: this slot is unfiltered,
          so deselecting every chip must not take it down with the
          per-exercise blocks. */}
      {afterSections}

      {visibleStats.length > 0 ? (
        <section className="mt-10">
          {statsHeading}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visibleStats.map(({ exercise, node }) => (
              <div key={exercise}>{node}</div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
