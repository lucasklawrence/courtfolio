import type { JSX } from 'react'
import Link from 'next/link'

import { slugLabel, type ExerciseLabels } from '@/lib/training-facility/exercise-labels'
import type { TemplateHistory } from '@/lib/training-facility/template-history'

/** Props for {@link TemplateCompositionPanel}. */
export interface TemplateCompositionPanelProps {
  /** The template's aggregated run history. */
  history: TemplateHistory
  /** Slug → human-readable movement name, from `buildExerciseLabels`. */
  exerciseLabels: ExerciseLabels
  /** Link to a movement's own trend; omit to render names as plain text. */
  exerciseHref?: (slug: string) => string
}

/**
 * What actually ran under a template, over its whole history (#446).
 *
 * This is the page's answer to "prescribed vs actual", and it deliberately
 * isn't an adherence score. No session in the log carries a frozen
 * prescription, so the only thing to score against is *today's* template — and
 * templates drift, heavily: across this log fifteen movements were logged under
 * templates that no longer list them. A percentage computed that way would
 * grade a 2023 session against a 2026 plan and present the result as fact.
 *
 * So it reports rather than grades: every movement that ran, how often, with
 * the ones the template has since dropped marked as such. That is checkable
 * against the sessions themselves.
 *
 * A Server Component.
 */
export function TemplateCompositionPanel({
  history,
  exerciseLabels,
  exerciseHref,
}: TemplateCompositionPanelProps): JSX.Element {
  const { movements, neverRun, runs } = history
  const mostRuns = movements.reduce((max, m) => Math.max(max, m.runs), 0)

  return (
    <section
      data-testid="template-composition"
      className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-5"
    >
      <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
        What actually ran
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-[#e8d5be]/75">
        Every movement logged under this workout, most load moved first — not what the template
        prescribes today. Sessions from before an edit still happened.
      </p>

      {movements.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[#e8d5be]/60">
          No sets have been logged under this workout yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {movements.map(movement => {
            const label = slugLabel(movement.exercise, undefined, exerciseLabels)
            const share = mostRuns === 0 ? 0 : movement.runs / mostRuns
            return (
              <li key={movement.exercise} data-testid={`template-movement-${movement.exercise}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#f7ead9]">
                    {exerciseHref === undefined ? (
                      label
                    ) : (
                      <Link
                        href={exerciseHref(movement.exercise)}
                        className="underline decoration-white/25 underline-offset-4 hover:decoration-white/60"
                      >
                        {label}
                      </Link>
                    )}
                    {!movement.prescribed ? (
                      <span
                        data-testid={`template-movement-retired-${movement.exercise}`}
                        className="ml-2 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-[#e8d5be]/70"
                      >
                        no longer in this workout
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-[11px] text-[#e8d5be]/60">
                    {movement.runs} of {runs.length} runs · {movement.sets} sets ·{' '}
                    {movement.tonnage.toLocaleString()} lb
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/8"
                >
                  <div
                    className={
                      movement.prescribed ? 'h-full bg-amber-300/70' : 'h-full bg-[#e8d5be]/30'
                    }
                    style={{ width: `${Math.round(share * 100)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {neverRun.length > 0 ? (
        <p
          data-testid="template-never-run"
          className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-[#e8d5be]/60"
        >
          Prescribed but never logged under this workout:{' '}
          {neverRun.map(slug => slugLabel(slug, undefined, exerciseLabels)).join(', ')}.
        </p>
      ) : null}
    </section>
  )
}
