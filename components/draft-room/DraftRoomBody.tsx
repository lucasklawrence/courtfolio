import type { PanelResult } from '@/lib/panel/types'
import { PersonaVerdictCard } from './PersonaVerdictCard'
import { AgreementMap } from './AgreementMap'
import { SynthesisPanel } from './SynthesisPanel'
import { WhyNoDebate } from './WhyNoDebate'

/** Props for {@link DraftRoomBody}. */
interface DraftRoomBodyProps {
  /** The complete panel result to render. */
  result: PanelResult
}

/**
 * The Draft Room's result sections — persona cards, the why-no-debate note,
 * the agreement/disagreement map, and the meta-judge synthesis — for a
 * *complete* {@link PanelResult}. Extracted from {@link DraftRoom} so the live
 * island (#241) can swap this replay body for its streaming layout while the
 * replay page's rendering stays unchanged.
 */
export function DraftRoomBody({ result }: DraftRoomBodyProps) {
  const { verdicts, synthesis } = result
  const labelById = Object.fromEntries(synthesis.scoreboard.map(s => [s.personaId, s.label]))

  return (
    <>
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
    </>
  )
}
