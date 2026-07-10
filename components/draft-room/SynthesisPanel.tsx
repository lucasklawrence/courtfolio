import type { MetaSynthesis } from '@/lib/panel/types'

/** Props for {@link SynthesisPanel}. */
interface SynthesisPanelProps {
  /** The meta-judge's synthesis. */
  synthesis: MetaSynthesis
}

/**
 * The meta-judge's closing panel: robust findings, the priority moves, the
 * overruled panel claims (the verifier's catches — surfaced, never hidden), and
 * the one-paragraph verdict. Rendered last, as the synthesis weighs the split.
 */
export function SynthesisPanel({ synthesis }: SynthesisPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-neutral-800 p-5">
          <h3 className="font-sans text-lg font-bold text-white">Robust findings</h3>
          <p className="mt-1 text-xs text-neutral-500">Held up across different theses.</p>
          <ul className="mt-3 flex flex-col gap-3">
            {synthesis.robustFindings.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-neutral-200">
                <span aria-hidden="true" className="text-orange-400">
                  ●
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-neutral-800 p-5">
          <h3 className="font-sans text-lg font-bold text-white">Top moves</h3>
          <p className="mt-1 text-xs text-neutral-500">Highest leverage, in order.</p>
          <ol className="mt-3 flex flex-col gap-2">
            {synthesis.topMoves.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm text-neutral-200">
                <span className="font-mono text-sm font-bold tabular-nums text-orange-400">
                  {i + 1}
                </span>
                <span>{m}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {synthesis.caughtErrors.length > 0 ? (
        <section className="rounded-2xl border border-yellow-400/30 bg-neutral-800 p-5">
          <h3 className="font-sans text-lg font-bold text-yellow-300">
            ⚠️ Overruled scouting claims
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            The fact-checker re-checked every grounded claim against the film and threw these out —
            confident-sounding, but wrong.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {synthesis.caughtErrors.map((e, i) => (
              <li key={i} className="border-l-2 border-yellow-400/50 pl-3">
                <p className="text-sm text-neutral-200">“{e.claim}”</p>
                <p className="mt-0.5 text-sm text-neutral-400">{e.verifyNote}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-orange-500/40 bg-gradient-to-b from-neutral-800 to-neutral-900 p-6">
        <span className="inline-block -rotate-1 rounded border-2 border-orange-500/60 px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-orange-300">
          Front office verdict
        </span>
        <p className="mt-3 text-base leading-relaxed text-neutral-100">{synthesis.verdict}</p>
      </section>
    </div>
  )
}
