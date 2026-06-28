import type { ConvergencePoint, DisagreementPoint } from '@/lib/panel/types'

/** Props for {@link AgreementMap}. */
interface AgreementMapProps {
  /** Where panelists independently agreed. */
  convergence: ConvergencePoint[]
  /** Where panelists split — the most honest signal on the page. */
  disagreements: DisagreementPoint[]
  /** Maps a personaId to its display label. */
  labelById: Record<string, string>
}

/**
 * The agreement / disagreement map. Convergence (high-confidence, because it was
 * reached independently) sits beside the split — and the split is given the
 * visual weight, since per the research the disagreement is the most honest
 * signal: it shows where reasonable evaluators genuinely diverge.
 */
export function AgreementMap({ convergence, disagreements, labelById }: AgreementMapProps) {
  const label = (id: string) => labelById[id] ?? id
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-neutral-800 p-5">
        <h3 className="font-sans text-lg font-bold text-white">Where they converged</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Reached independently — so it carries weight.
        </p>
        <ul className="mt-4 flex flex-col gap-4">
          {convergence.map((c, i) => (
            <li key={i}>
              <p className="text-sm text-neutral-200">{c.finding}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.personaIds.map(id => (
                  <span
                    key={id}
                    className="rounded-full bg-green-500/10 px-2 py-0.5 font-mono text-[0.625rem] text-green-300"
                  >
                    {label(id)}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-orange-500/30 bg-neutral-800 p-5 shadow-[0_0_32px_rgba(249,115,22,0.10)]">
        <h3 className="font-sans text-lg font-bold text-orange-300">Where they split</h3>
        <p className="mt-1 text-xs text-neutral-400">The most honest signal on the page.</p>
        <ul className="mt-4 flex flex-col gap-5">
          {disagreements.map((d, i) => (
            <li key={i}>
              <p className="text-sm font-semibold text-white">{d.topic}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {d.positions.map(p => (
                  <li key={p.personaId} className="text-sm text-neutral-300">
                    <span className="font-mono text-[0.6875rem] text-orange-300">
                      {label(p.personaId)}:
                    </span>{' '}
                    {p.stance}
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-l-2 border-orange-500/50 pl-3 text-sm italic text-neutral-300">
                {d.honestSignal}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
