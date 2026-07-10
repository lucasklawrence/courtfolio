import type { PersonaVerdict, VerifyVerdict } from '@/lib/panel/types'
import { ScoreMeter } from './ScoreMeter'

/** How the eval on a report card was produced — drives the corner stamp. */
export type EvalStamp = 'live' | 'cached' | 'stored'

/** Props for {@link PersonaVerdictCard}. */
interface PersonaVerdictCardProps {
  /** One panelist's independent verdict. */
  verdict: PersonaVerdict
  /**
   * Live mode only (#241): the fact-checker's ruling per gap index, landed as
   * each verifier call settles. Omitted on the replay page — concerns render
   * without ruling annotations, exactly as before.
   */
  gapRulings?: Partial<Record<number, VerifyVerdict>>
  /** Display name of the thing under evaluation (the report's PROSPECT line). */
  prospect?: string
  /** Gateway model id shown as the report's instrument chip; hidden when empty. */
  model?: string
  /** Corner stamp: how this eval was produced. Omitted → no stamp. */
  evalStamp?: EvalStamp
  /** ISO timestamp of when the eval ran, shown on the EVAL line when present. */
  evalDate?: string
}

/** Corner-stamp copy + ink per {@link EvalStamp}. */
const EVAL_STAMPS: Record<EvalStamp, { text: string; className: string }> = {
  live: { text: 'Live eval', className: 'border-red-800/60 text-red-800/90' },
  cached: { text: 'Recent eval — replayed', className: 'border-neutral-700/50 text-neutral-700' },
  stored: { text: 'Stored eval', className: 'border-neutral-700/50 text-neutral-700' },
}

/** Ruling annotation copy + ink per verifier verdict (report ink on paper). */
const RULING_BADGES: Record<VerifyVerdict, { text: string; className: string }> = {
  upheld: { text: '✓ upheld', className: 'bg-green-800/10 text-green-900' },
  refuted: { text: '✗ overruled', className: 'bg-red-800/10 text-red-800' },
  unverifiable: { text: '? unverifiable', className: 'bg-neutral-900/5 text-neutral-600' },
}

/** The model chip's display text: strip the gateway vendor prefix. */
function modelShortName(model: string): string {
  return model.split('/').pop() ?? model
}

/** `YYYY-MM-DD` from an ISO timestamp, for the report's EVAL line. */
function evalDay(iso: string): string {
  return iso.slice(0, 10)
}

/** A dashed ink divider between report sections. */
function ReportRule() {
  return <hr className="border-t border-dashed border-neutral-900/20" />
}

/** A report section's letterpress heading. */
function ReportHeading({ children }: { children: string }) {
  return (
    <span className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-neutral-700">
      {children}
    </span>
  )
}

/**
 * A single scout's report, styled as a printed document filed against the
 * dark arena: header block (prospect / scout / eval), GRADES, CONCERNS
 * (claim vs. film), and the BOTTOM LINE.
 *
 * This is the "independent deliberation" surface — each report stands alone,
 * never referencing the others, because the panel judges independently (no
 * debate).
 *
 * In live mode the fact-checker's rulings are annotated onto the filed report
 * as each gap is re-checked: overruled claims get struck through, not
 * removed — the catch is the feature.
 */
export function PersonaVerdictCard({
  verdict,
  gapRulings,
  prospect,
  model,
  evalStamp,
  evalDate,
}: PersonaVerdictCardProps) {
  const stamp = evalStamp ? EVAL_STAMPS[evalStamp] : undefined
  return (
    <article className="flex h-full flex-col gap-4 rounded-md border border-neutral-900/20 bg-[#f5f0e4] p-5 text-neutral-900 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <ReportHeading>Scouting report</ReportHeading>
          {stamp ? (
            <span
              className={`-rotate-3 rounded border-2 px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-[0.18em] ${stamp.className}`}
            >
              {stamp.text}
            </span>
          ) : null}
        </div>
        <dl className="flex flex-col gap-0.5 font-mono text-xs text-neutral-700">
          {prospect ? (
            <div className="flex gap-2">
              <dt className="uppercase tracking-[0.12em] text-neutral-500">Prospect</dt>
              <dd className="font-bold text-neutral-900">{prospect}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="uppercase tracking-[0.12em] text-neutral-500">Scout</dt>
            <dd>
              <h3 className="inline font-mono text-xs font-bold text-neutral-900">
                {verdict.label}
              </h3>
            </dd>
          </div>
          {evalDate ? (
            <div className="flex gap-2">
              <dt className="uppercase tracking-[0.12em] text-neutral-500">Eval</dt>
              <dd>{evalDay(evalDate)}</dd>
            </div>
          ) : null}
        </dl>
        {model ? (
          <span className="w-fit rounded-sm bg-neutral-900/10 px-1.5 py-0.5 font-mono text-[0.625rem] text-neutral-700">
            {modelShortName(model)}
          </span>
        ) : null}
      </header>

      <ReportRule />

      <div className="flex flex-col gap-3">
        <ReportHeading>Grades</ReportHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {verdict.scores.map(s => (
            <ScoreMeter key={s.axisId} axisId={s.axisId} score={s.score} rationale={s.rationale} />
          ))}
        </div>
      </div>

      <ReportRule />

      <div className="flex flex-col gap-3">
        <ReportHeading>Concerns (claim vs. film)</ReportHeading>
        <ul className="flex flex-col gap-3">
          {verdict.gaps.map((gap, i) => {
            const ruling = gapRulings?.[i]
            return (
              <li key={i} className="border-l-2 border-orange-700/50 pl-3">
                <p
                  className={`text-sm font-medium text-neutral-900${
                    ruling === 'refuted' ? ' line-through decoration-red-800/60' : ''
                  }`}
                >
                  {gap.claim}
                </p>
                <p className="mt-0.5 text-sm text-neutral-600">{gap.artifactShows}</p>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <code className="inline-block rounded-sm bg-neutral-900/10 px-1.5 py-0.5 font-mono text-[0.6875rem] text-neutral-800">
                    {gap.citation}
                  </code>
                  {ruling ? (
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-[0.08em] ${RULING_BADGES[ruling].className}`}
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

      <ReportRule />

      <div className="mt-auto flex flex-col gap-2">
        <ReportHeading>Bottom line</ReportHeading>
        <p className="border-l-2 border-red-800/40 pl-3 text-sm font-medium italic leading-snug text-neutral-800">
          {verdict.uncomfortableTruth}
        </p>
      </div>

      {verdict.standoutObservation ? (
        <p className="text-xs leading-snug text-neutral-600">
          <span className="font-mono font-bold uppercase tracking-[0.08em] text-orange-700">
            Standout —{' '}
          </span>
          {verdict.standoutObservation}
        </p>
      ) : null}
    </article>
  )
}
