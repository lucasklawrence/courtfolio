import type { JSX } from 'react'
import Link from 'next/link'

import {
  EXERCISE_FILTER_PARAM,
  serializeExerciseSelection,
  toggleExercise,
} from '@/lib/training-facility/exercise-filter'

/** One selectable exercise, in render order. */
export interface FilterableExercise {
  /** Exercise slug; the URL token and the chip's identity. */
  exercise: string
  /**
   * Human label for the chip (#384). Absent falls back to {@link exercise}.
   * The URL token always stays the slug, so a filtered link keeps working
   * regardless of what the catalog calls the movement.
   */
  displayName?: string
  /** Hex accent from the goal, used to tint the chip when selected. */
  color: string
  /** Whether this is a "grease the groove" focus anchor rather than a permanent goal. */
  isFocus: boolean
}

/** Props for {@link ExerciseFilterChips}. */
export interface ExerciseFilterChipsProps {
  /** Every exercise offering a chip, in render order. */
  exercises: readonly FilterableExercise[]
  /** Currently selected exercises, already resolved from the URL by the page. */
  selected: readonly string[]
  /** Route the chips link back to, e.g. `/training-facility/weight-room/history`. */
  pathname: string
  /**
   * Query params to carry through, minus the filter param. Keeps an unrelated
   * `?preview=demo` alive when a chip is toggled.
   */
  carryParams?: Readonly<Record<string, string>>
}

/**
 * Exercise toggle chips for the History view (#367).
 *
 * **A Server Component, deliberately.** The page is already dynamically
 * rendered (`isAdminRequest()` reads cookies), so the filter is resolved
 * server-side from `searchParams` and the page ships only the selected
 * sections. That means:
 *
 * - the first paint is already correct, including for a *linked* filtered
 *   view — no flash of everything before narrowing, which any client-side
 *   filter would have;
 * - filtering works with JavaScript disabled, since each chip is a plain
 *   `<Link>` to the same route with that exercise toggled;
 * - no chart is re-rendered in the browser, and no filter state is duplicated
 *   between server and client.
 *
 * Chips are links rather than buttons because their action *is* a navigation —
 * the URL is the state. `aria-label` spells out the effect ("Hide pushups")
 * since the visual pressed-ness isn't available to a screen reader the way
 * `aria-pressed` would be on a button.
 */
export function ExerciseFilterChips({
  exercises,
  selected,
  pathname,
  carryParams = {},
}: ExerciseFilterChipsProps): JSX.Element {
  const available = exercises.map(e => e.exercise)
  const selectedSet = new Set(selected)
  const allSelected = selected.length === available.length

  /** Build the href that results from toggling `exercise`. */
  const hrefFor = (exercise: string): string => {
    const next = toggleExercise(selected, exercise, available)
    return buildHref(serializeExerciseSelection(next, available), pathname, carryParams)
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-2" data-testid="exercise-filter">
      <span
        id="exercise-filter-label"
        className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300/70"
      >
        Show
      </span>
      <nav aria-labelledby="exercise-filter-label" className="flex flex-wrap gap-2">
        {exercises.map(({ exercise, displayName, color, isFocus }) => {
          const isOn = selectedSet.has(exercise)
          return (
            <Link
              key={exercise}
              href={hrefFor(exercise)}
              scroll={false}
              data-testid={`exercise-chip-${exercise}`}
              data-selected={isOn}
              aria-label={`${isOn ? 'Hide' : 'Show'} ${displayName ?? exercise}`}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                isOn
                  ? 'border-transparent text-[#0a0a0a]'
                  : 'border-white/20 text-white/45 hover:text-white/70'
              }`}
              style={isOn ? { backgroundColor: color } : undefined}
            >
              {displayName ?? exercise}
              {isFocus ? <span className="ml-1.5 opacity-70">GTG</span> : null}
            </Link>
          )
        })}
      </nav>
      {!allSelected ? (
        <Link
          href={buildHref(null, pathname, carryParams)}
          scroll={false}
          data-testid="exercise-chip-reset"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 underline underline-offset-4 hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          show all
        </Link>
      ) : null}
    </div>
  )
}

/**
 * Compose a chip href from an encoded selection plus the params to carry.
 *
 * @param encoded Result of {@link serializeExerciseSelection} — `null` drops
 *   the filter param entirely, which is how "everything selected" is spelled.
 * @param pathname Route to link to.
 * @param carryParams Unrelated params to preserve.
 */
function buildHref(
  encoded: string | null,
  pathname: string,
  carryParams: Readonly<Record<string, string>>
): string {
  const params = new URLSearchParams(carryParams)
  if (encoded !== null) params.set(EXERCISE_FILTER_PARAM, encoded)
  const query = params.toString()
  return query === '' ? pathname : `${pathname}?${query}`
}
