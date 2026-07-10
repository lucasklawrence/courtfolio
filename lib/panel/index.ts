/**
 * Public entry point for the judge-panel engine (#234). Liftable: import
 * {@link runPanel} from another repo, pass a different {@link PanelConfig} and
 * {@link EvidenceContext}, and the same pipeline judges anything (#235).
 *
 * Pipeline: independent personas → adversarial verify → meta-judge synthesis.
 */
import { assertValidConfig } from './config'
import { PanelDegradedError, runPersonaPanel } from './run-panel'
import { caughtErrors, refutedNote, stripRefutedGaps, verifyGaps } from './verify'
import { buildScoreboard, synthesize } from './synthesize'
import type { EvidenceContext, PanelConfig, PanelResult, PanelRunOptions, Thesis } from './types'

/**
 * Run the full panel against a thesis and its evidence.
 *
 * Progress is observable via `opts.onEvent` (one event per settled persona /
 * verified gap — see {@link PanelEvent}), and the whole run is cancellable via
 * `opts.signal`. A failed persona benches (recorded in
 * {@link PanelResult.personaFailures}) rather than failing the run, down to
 * the `opts.minSurvivors` floor (default 1).
 *
 * @param thesis the author's claim to pressure-test
 * @param evidence the grounding the panel reasons over (from an evidence adapter)
 * @param config personas, axes, and model lineup (e.g. {@link portfolioConfig})
 * @param opts progress listener, cancellation signal, survivor floor
 * @throws if the config is invalid, the run is cancelled, fewer personas
 *   survive than `opts.minSurvivors` ({@link PanelDegradedError}), or the
 *   verify/synthesis stages fail
 */
export async function runPanel(
  thesis: Thesis,
  evidence: EvidenceContext,
  config: PanelConfig,
  opts: PanelRunOptions = {}
): Promise<PanelResult> {
  assertValidConfig(config)

  const { verdicts, failures } = await runPersonaPanel(thesis, evidence, config, opts)

  // Enforce the survivor floor before any verify/synthesis spend: below it
  // there is no panel to synthesize, only a partial opinion.
  const minSurvivors = Math.max(1, opts.minSurvivors ?? 1)
  if (verdicts.length < minSurvivors) {
    throw new PanelDegradedError(verdicts, failures, minSurvivors)
  }

  const verifiedGaps = await verifyGaps(verdicts, evidence, config, opts)

  const stripped = stripRefutedGaps(verdicts, verifiedGaps)
  // When personas are benched, tell the meta-judge — it must synthesize from
  // the verdicts that exist, not invent the missing perspectives.
  const absenceNote =
    failures.length > 0
      ? `${failures.length} persona(s) failed to report and are absent from this panel: ${failures
          .map(f => f.personaId)
          .join(
            ', '
          )}. Synthesize from the verdicts above only; do not invent the missing perspectives.`
      : ''
  const body = await synthesize(thesis, stripped, refutedNote(verifiedGaps), config, opts, absenceNote)

  return {
    thesis,
    verdicts,
    verifiedGaps,
    ...(failures.length > 0 ? { personaFailures: failures } : {}),
    synthesis: {
      targetId: thesis.targetId,
      scoreboard: buildScoreboard(verdicts),
      caughtErrors: caughtErrors(verifiedGaps),
      ...body,
    },
  }
}

export { portfolioConfig, PORTFOLIO_AXES, assertValidConfig } from './config'
export { PORTFOLIO_PERSONAS, DRAFT_ROOM_PERSONAS } from './personas'
export { DEFAULT_LINEUP } from './models'
export { PanelDegradedError } from './run-panel'
export { textEvidence } from './evidence/text-evidence'
export { repoEvidence } from './evidence/repo-evidence'
export type * from './types'
