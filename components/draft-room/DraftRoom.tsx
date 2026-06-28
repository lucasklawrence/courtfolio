import type { PanelResult } from '@/lib/panel/types'
import { PersonaVerdictCard } from './PersonaVerdictCard'
import { AgreementMap } from './AgreementMap'
import { SynthesisPanel } from './SynthesisPanel'
import { WhyNoDebate } from './WhyNoDebate'

/** Props for {@link DraftRoom}. */
interface DraftRoomProps {
  /** The stored panel result to replay. */
  result: PanelResult
  /** Whether the result is hand-authored illustrative data (drives the badge). */
  illustrative: boolean
}

/**
 * The Draft Room showcase: replays a stored {@link PanelResult} so the panel's
 * deliberation reads top-to-bottom — personas first (independently), then the
 * agreement/disagreement map, then the meta-judge's synthesis.
 *
 * It's a *replay*, not a live run: the result is pre-baked, so the page costs
 * nothing to visit and exposes no paid endpoint. Honest about that via the
 * illustrative badge until a real run replaces the data.
 *
 * Sections fade up on scroll via the native `.reveal` class (CSS scroll-driven,
 * off the main thread) — which degrades to fully-visible where unsupported or
 * under reduced-motion, so content is never left hidden behind JS. This is a
 * server component; no client JS is needed to render the showcase.
 */
export function DraftRoom({ result, illustrative }: DraftRoomProps) {
  const { thesis, verdicts, synthesis } = result
  const labelById = Object.fromEntries(synthesis.scoreboard.map(s => [s.personaId, s.label]))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300">
          The Draft Room
        </span>
        <h1 className="font-sans text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
          The front office grades the prospect
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-neutral-300">
          A multi-persona panel pressure-tests a claim against the actual artifact — finding the gap
          between what’s claimed and what the code shows. The prospect on the board:{' '}
          <span className="text-orange-300">Courtfolio</span> itself.
        </p>

        <div className="mt-2 rounded-2xl border border-white/10 bg-neutral-800 p-5">
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300/80">
            The thesis under test
          </span>
          <ol className="mt-2 flex flex-col gap-2">
            {thesis.claims.map((c, i) => (
              <li key={i} className="flex gap-3 text-sm text-neutral-200">
                <span className="font-mono text-xs tabular-nums text-neutral-500">{i + 1}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </div>

        {illustrative ? (
          <p className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-xs text-yellow-200/90">
            Illustrative — authored from a real terminal verdict. A live cross-family run will
            replace it; the mechanic and findings are real.
          </p>
        ) : null}
      </header>

      <section aria-label="Panelist verdicts" className="flex flex-col gap-5">
        <h2 className="font-sans text-2xl font-bold text-white">
          The panel weighs in — independently
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {verdicts.map(v => (
            <div key={v.personaId} className="reveal">
              <PersonaVerdictCard verdict={v} />
            </div>
          ))}
        </div>
      </section>

      <div className="reveal">
        <WhyNoDebate />
      </div>

      <section aria-label="Agreement and disagreement" className="reveal flex flex-col gap-5">
        <h2 className="font-sans text-2xl font-bold text-white">Converge vs. split</h2>
        <AgreementMap
          convergence={synthesis.convergence}
          disagreements={synthesis.disagreements}
          labelById={labelById}
        />
      </section>

      <section aria-label="Meta-judge synthesis" className="reveal flex flex-col gap-5">
        <h2 className="font-sans text-2xl font-bold text-white">The meta-judge synthesizes</h2>
        <SynthesisPanel synthesis={synthesis} />
      </section>
    </div>
  )
}
