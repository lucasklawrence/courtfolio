/**
 * Stage 3: meta-judge synthesis. A single stronger model aggregates the
 * *independent* (refuted-stripped) verdicts. It does NOT re-judge the artifact;
 * it weighs convergence and — crucially — surfaces disagreement, which #234
 * identifies as the most honest signal. Aggregation stays near baseline bias,
 * unlike debate.
 */
import { generateStructured } from './models'
import { metaSynthesisSchema } from './schemas'
import type { MetaSynthesisOutput } from './schemas'
import { buildSynthesisPrompt } from './prompts'
import type { MetaSynthesis, PanelConfig, PersonaVerdict, Thesis } from './types'

/** Build the deterministic scoreboard straight from the verdicts (not model-produced). */
export function buildScoreboard(verdicts: PersonaVerdict[]): MetaSynthesis['scoreboard'] {
  return verdicts.map(v => ({ personaId: v.personaId, label: v.label, scores: v.scores }))
}

/**
 * Run the meta-judge and return its synthesis body (convergence, disagreements,
 * robust findings, moves, verdict). Identity/scoreboard/caughtErrors are
 * assembled by the caller ({@link runPanel}) from deterministic data.
 *
 * @param thesis the claim under test
 * @param strippedVerdicts verdicts with refuted gaps already removed
 * @param refutedNote human-readable list of discarded gaps (may be empty)
 * @param config supplies the meta-judge model id
 * @throws if the meta-judge model call fails
 */
export function synthesize(
  thesis: Thesis,
  strippedVerdicts: PersonaVerdict[],
  refutedNote: string,
  config: PanelConfig
): Promise<MetaSynthesisOutput> {
  return generateStructured<MetaSynthesisOutput>({
    model: config.lineup.metaJudge,
    system:
      'You are a fair, incisive meta-judge. You never average away disagreement; you surface it.',
    prompt: buildSynthesisPrompt(thesis, strippedVerdicts, refutedNote),
    schema: metaSynthesisSchema,
  })
}
