import type { PersonaVerdict } from '@/lib/panel/types'
import { ScoreMeter } from './ScoreMeter'

/** Props for {@link PersonaVerdictCard}. */
interface PersonaVerdictCardProps {
  /** One panelist's independent verdict. */
  verdict: PersonaVerdict
}

/**
 * A single panelist's card: scores on each axis, the gaps they found (claim →
 * what the artifact shows, with a citation), and the one uncomfortable truth.
 *
 * This is the "independent deliberation" surface — each card stands alone, never
 * referencing the others, because the panel judges independently (no debate).
 */
export function PersonaVerdictCard({ verdict }: PersonaVerdictCardProps) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-800 p-5 shadow-md">
      <header>
        <h3 className="font-sans text-lg font-bold text-white">{verdict.label}</h3>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {verdict.scores.map(s => (
          <ScoreMeter key={s.axisId} axisId={s.axisId} score={s.score} rationale={s.rationale} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300/80">
          Gaps (claim vs. artifact)
        </span>
        <ul className="flex flex-col gap-3">
          {verdict.gaps.map((gap, i) => (
            <li key={i} className="border-l-2 border-orange-500/40 pl-3">
              <p className="text-sm font-medium text-neutral-200">{gap.claim}</p>
              <p className="mt-0.5 text-sm text-neutral-400">{gap.artifactShows}</p>
              <code className="mt-1 inline-block rounded bg-orange-500/10 px-1.5 py-0.5 font-mono text-[0.6875rem] text-orange-300">
                {gap.citation}
              </code>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto rounded-lg bg-black/30 p-3">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-neutral-500">
          Uncomfortable truth
        </span>
        <p className="mt-1 text-sm italic leading-snug text-neutral-300">
          {verdict.uncomfortableTruth}
        </p>
      </div>

      {verdict.standoutObservation ? (
        <p className="text-xs leading-snug text-neutral-500">
          <span className="text-orange-300">Standout — </span>
          {verdict.standoutObservation}
        </p>
      ) : null}
    </article>
  )
}
