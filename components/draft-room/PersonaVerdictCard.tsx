import type { PersonaVerdict, VerifyVerdict } from '@/lib/panel/types'
import { ScoreMeter } from './ScoreMeter'

/** Props for {@link PersonaVerdictCard}. */
interface PersonaVerdictCardProps {
  /** One panelist's independent verdict. */
  verdict: PersonaVerdict
  /**
   * Live mode only (#241): the fact-checker's ruling per gap index, landed as
   * each verifier call settles. Omitted on the replay page — gaps render
   * without badges, exactly as before.
   */
  gapRulings?: Partial<Record<number, VerifyVerdict>>
}

/** Badge copy + classes per verifier ruling. The overruled state is the loud one on purpose. */
const RULING_BADGES: Record<VerifyVerdict, { text: string; className: string }> = {
  upheld: { text: '✓ upheld', className: 'bg-green-500/10 text-green-300' },
  refuted: { text: '✗ overruled', className: 'bg-yellow-400/10 text-yellow-300' },
  unverifiable: { text: '? unverifiable', className: 'bg-white/5 text-neutral-400' },
}

/**
 * A single panelist's card: scores on each axis, the gaps they found (claim →
 * what the artifact shows, with a citation), and the one uncomfortable truth.
 *
 * This is the "independent deliberation" surface — each card stands alone, never
 * referencing the others, because the panel judges independently (no debate).
 *
 * In live mode the fact-checker's rulings rain onto the finished card as each
 * gap is re-checked: overruled claims get struck through, not deleted — the
 * catch is the feature.
 */
export function PersonaVerdictCard({ verdict, gapRulings }: PersonaVerdictCardProps) {
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
          {verdict.gaps.map((gap, i) => {
            const ruling = gapRulings?.[i]
            return (
              <li key={i} className="border-l-2 border-orange-500/40 pl-3">
                <p
                  className={`text-sm font-medium text-neutral-200${
                    ruling === 'refuted' ? ' line-through decoration-yellow-400/60' : ''
                  }`}
                >
                  {gap.claim}
                </p>
                <p className="mt-0.5 text-sm text-neutral-400">{gap.artifactShows}</p>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <code className="inline-block rounded bg-orange-500/10 px-1.5 py-0.5 font-mono text-[0.6875rem] text-orange-300">
                    {gap.citation}
                  </code>
                  {ruling ? (
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[0.625rem] ${RULING_BADGES[ruling].className}`}
                    >
                      {RULING_BADGES[ruling].text}
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
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
