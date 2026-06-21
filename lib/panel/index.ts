/**
 * Public entry point for the judge-panel engine (#234). Liftable: import
 * {@link runPanel} from another repo, pass a different {@link PanelConfig} and
 * {@link EvidenceContext}, and the same pipeline judges anything (#235).
 *
 * Pipeline: independent personas → adversarial verify → meta-judge synthesis.
 */
import { assertValidConfig } from './config'
import { runPersonaPanel } from './run-panel'
import { caughtErrors, refutedNote, stripRefutedGaps, verifyGaps } from './verify'
import { buildScoreboard, synthesize } from './synthesize'
import type { EvidenceContext, PanelConfig, PanelResult, Thesis } from './types'

/**
 * Run the full panel against a thesis and its evidence.
 *
 * @param thesis the author's claim to pressure-test
 * @param evidence the grounding the panel reasons over (from an evidence adapter)
 * @param config personas, axes, and model lineup; defaults to {@link portfolioConfig}
 * @returns every stage's output — verdicts, verified gaps, and the synthesis
 * @throws if the config is invalid or any model stage fails
 */
export async function runPanel(
  thesis: Thesis,
  evidence: EvidenceContext,
  config: PanelConfig
): Promise<PanelResult> {
  assertValidConfig(config)

  const verdicts = await runPersonaPanel(thesis, evidence, config)
  const verifiedGaps = await verifyGaps(verdicts, evidence, config)

  const stripped = stripRefutedGaps(verdicts, verifiedGaps)
  const body = await synthesize(thesis, stripped, refutedNote(verifiedGaps), config)

  return {
    thesis,
    verdicts,
    verifiedGaps,
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
export { textEvidence } from './evidence/text-evidence'
export { repoEvidence } from './evidence/repo-evidence'
export type * from './types'
