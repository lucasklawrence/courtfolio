'use client'

/**
 * The Draft Room's live mode (#241): the replay page plus a guarded
 * "Run it live" button that triggers a real cross-family panel run and fills
 * the same card surfaces as events stream in.
 *
 * Honesty rules the layout: idle shows the stored replay (labeled), a run
 * streams verdict-complete cards as each vendor actually finishes (the
 * staggering IS the independence proof), the fact-checker's rulings land on
 * finished cards one gap at a time, the synthesis arrives last, and a cached
 * replay of someone else's recent run says exactly that. Failures keep
 * whatever already streamed — nothing is papered over.
 */
import type { PanelResult } from '@/lib/panel/types'
import { prospectLabel } from './axes'
import { DraftRoomHeader } from './DraftRoomHeader'
import { DraftRoomBody } from './DraftRoomBody'
import { PersonaVerdictCard } from './PersonaVerdictCard'
import { PersonaBenchedCard, PersonaPendingCard } from './PersonaPendingCard'
import { AgreementMap } from './AgreementMap'
import { SynthesisPanel } from './SynthesisPanel'
import { WhyNoDebate } from './WhyNoDebate'
import { useLivePanelRun, type LivePanelRunState } from './useLivePanelRun'

/** Props for {@link LiveDraftRoom}. */
interface LiveDraftRoomProps {
  /** The stored result shown until (and instead of) a live run. */
  replay: PanelResult
  /** Whether `replay` is hand-authored illustrative data (drives the badge). */
  illustrative: boolean
  /** The registered live target to run. */
  targetId: string
}

/** Human copy per early-failure kind (no run content on screen yet — the stored replay stays below). */
const FAILURE_COPY: Record<string, string> = {
  'rate-limited':
    'The panel has hit its run budget for now — the most recent result is shown below.',
  'in-progress': 'A live run is already in progress — its result will be shared here shortly.',
  unavailable: 'Live runs are unavailable right now — the stored result is shown below.',
  network: 'The stream dropped before finishing — the stored result is shown below.',
  stalled: 'The stream went quiet and was cut off — the stored result is shown below.',
}

/** Human copy per failure kind once a run has started streaming (its cards stay on screen, so don't promise the replay). */
const MIDRUN_FAILURE_COPY: Record<string, string> = {
  network: 'The stream dropped before finishing — everything above arrived before the cut.',
  stalled: 'The stream went quiet and was cut off — everything above arrived before the cut.',
  'rate-limited': 'The panel hit its run budget mid-run — everything above arrived before the cut.',
  'in-progress': 'Another run took over — everything above arrived before the cut.',
  unavailable: 'Live runs became unavailable mid-run — everything above arrived before the cut.',
}

/** Minutes since an ISO timestamp, floored at 1. */
function minutesSince(iso: string): number {
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
}

/** The honesty label for a stream: live, or a labeled replay of a recent run. */
function streamLabel(state: LivePanelRunState): string {
  if (!state.runStart) return ''
  if (state.runStart.cached) {
    return `Replay of a real run from ${minutesSince(state.runStart.startedAt)} min ago — the run budget shares recent results instead of re-spending.`
  }
  if (state.status === 'done' && state.elapsedMs) {
    return `Live run — completed in ${Math.round(state.elapsedMs / 1000)}s.`
  }
  return 'Live run — three models from three vendors, deliberating independently right now.'
}

/** The run controls block rendered under the header. */
function RunControls({
  state,
  onRun,
}: {
  state: LivePanelRunState
  onRun: () => void
}) {
  const running = state.status === 'connecting' || state.status === 'streaming'
  return (
    <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-orange-500/30 bg-neutral-900 p-5">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300">
        Run it live
      </span>
      <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">
        Trigger a real run: three models from three vendors judge the thesis independently, a
        fact-checker re-checks every claim, and a meta-judge weighs the split — streamed here as
        it happens (~45s). Rate-limited and budget-capped; recent runs are shared.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="rounded-full bg-orange-500 px-5 py-2 font-sans text-sm font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? 'Panel deliberating…' : 'Run it live'}
        </button>
        {state.runStart ? (
          <span className="text-xs text-neutral-400">{streamLabel(state)}</span>
        ) : null}
        {state.status === 'error' && state.error && !state.runStart ? (
          <span className="text-xs text-yellow-200/90">
            {FAILURE_COPY[state.error.kind] ?? FAILURE_COPY.network}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** The streaming (and streamed) result sections for an in-flight or finished run. */
function LiveBody({ state }: { state: LivePanelRunState }) {
  const runStart = state.runStart
  if (!runStart) return null

  const verdictById = Object.fromEntries(state.verdicts.map(v => [v.personaId, v]))
  const errorById = Object.fromEntries(state.personaErrors.map(e => [e.personaId, e.errorType]))
  const labelById = Object.fromEntries(runStart.personas.map(p => [p.id, p.label]))

  const prospect = prospectLabel(runStart.targetId)
  const evalStamp = runStart.cached ? 'cached' : 'live'

  return (
    <>
      <section aria-label="Panelist verdicts" className="flex flex-col gap-5">
        <h2 className="font-sans text-2xl font-bold text-white">
          The scouting reports come in — filed independently
        </h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {runStart.personas.map(persona => {
            const verdict = verdictById[persona.id]
            if (verdict) {
              return (
                <PersonaVerdictCard
                  key={persona.id}
                  verdict={verdict}
                  gapRulings={state.gapRulings[persona.id]}
                  prospect={prospect}
                  model={persona.model || undefined}
                  evalStamp={evalStamp}
                  evalDate={runStart.startedAt}
                />
              )
            }
            if (errorById[persona.id]) {
              return (
                <PersonaBenchedCard
                  key={persona.id}
                  persona={persona}
                  errorType={errorById[persona.id]}
                />
              )
            }
            return <PersonaPendingCard key={persona.id} persona={persona} />
          })}
        </div>
      </section>

      <WhyNoDebate />

      {state.verify && !state.synthesis && state.status !== 'error' ? (
        <p aria-live="polite" className="font-mono text-xs text-neutral-400">
          Fact-checking the scouts’ claims against the film… {state.verify.done}/
          {state.verify.total} gaps re-checked.
        </p>
      ) : null}

      {state.synthesis ? (
        <>
          <section aria-label="Agreement and disagreement" className="flex flex-col gap-5">
            <h2 className="font-sans text-2xl font-bold text-white">
              The war room — converge vs. split
            </h2>
            <AgreementMap
              convergence={state.synthesis.convergence}
              disagreements={state.synthesis.disagreements}
              labelById={labelById}
            />
          </section>

          <section aria-label="Meta-judge synthesis" className="flex flex-col gap-5">
            <h2 className="font-sans text-2xl font-bold text-white">The front office decides</h2>
            <SynthesisPanel synthesis={state.synthesis} />
          </section>
        </>
      ) : null}

      {state.status === 'error' && state.error ? (
        <p className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-xs text-yellow-200/90">
          {state.error.kind === 'run-error'
            ? `The run failed during the ${state.error.stage ?? 'run'} stage. Everything above streamed before it died — kept as-is.`
            : (MIDRUN_FAILURE_COPY[state.error.kind] ?? MIDRUN_FAILURE_COPY.network)}
        </p>
      ) : null}
    </>
  )
}

/**
 * Compose the Draft Room's live mode: shared header + run controls, then
 * either the stored replay (idle / failed-before-start) or the streaming
 * layout. Mounted by the page only when `NEXT_PUBLIC_ENABLE_PANEL_LIVE` is on;
 * otherwise the page renders the zero-JS server replay.
 */
export function LiveDraftRoom({ replay, illustrative, targetId }: LiveDraftRoomProps) {
  const { state, start } = useLivePanelRun(targetId)

  // Show the live layout once a stream has started; before that (including a
  // 429/503 refused before run-start) the stored replay stays on screen.
  const showLive = state.runStart !== undefined

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6">
      <DraftRoomHeader thesis={replay.thesis} illustrative={showLive ? false : illustrative}>
        <RunControls state={state} onRun={start} />
      </DraftRoomHeader>
      {showLive ? <LiveBody state={state} /> : <DraftRoomBody result={replay} />}
    </div>
  )
}
