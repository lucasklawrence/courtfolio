/**
 * Stage 1: independent persona fan-out. Each persona judges in parallel and in
 * isolation — no debate, no shared context. Independence is the point: naive
 * multi-agent debate amplifies bias ~8–10% while independent-then-aggregate
 * stays near baseline (#234).
 */
import { generateStructured } from './models'
import { personaVerdictSchema } from './schemas'
import type { PersonaVerdictOutput } from './schemas'
import { buildPersonaPrompt } from './prompts'
import type { EvidenceContext, Gap, PanelConfig, PersonaVerdict, Thesis } from './types'

/** Normalize a model-produced gap (schema uses `claimIndex: number | null`) to the {@link Gap} shape. */
function toGap(g: PersonaVerdictOutput['gaps'][number]): Gap {
  return {
    claim: g.claim,
    artifactShows: g.artifactShows,
    citation: g.citation,
    confidence: g.confidence,
    ...(g.claimIndex === null ? {} : { claimIndex: g.claimIndex }),
  }
}

/**
 * Run every persona in the config against the thesis + evidence, concurrently.
 *
 * @param thesis the claim under test
 * @param evidence the grounding all personas reason from
 * @param config personas, axes, and the model lineup
 * @returns one {@link PersonaVerdict} per persona, in config order
 * @throws if any persona's model call fails (surfaces the underlying SDK error)
 */
export async function runPersonaPanel(
  thesis: Thesis,
  evidence: EvidenceContext,
  config: PanelConfig
): Promise<PersonaVerdict[]> {
  const prompt = buildPersonaPrompt(thesis, evidence, config.axes)

  return Promise.all(
    config.personas.map(async (persona): Promise<PersonaVerdict> => {
      const out = await generateStructured<PersonaVerdictOutput>({
        model: config.lineup.personas[persona.family],
        system: persona.systemPrompt,
        prompt,
        schema: personaVerdictSchema,
      })
      return {
        personaId: persona.id,
        label: persona.label,
        scores: out.scores,
        gaps: out.gaps.map(toGap),
        uncomfortableTruth: out.uncomfortableTruth,
        ...(out.standoutObservation === null
          ? {}
          : { standoutObservation: out.standoutObservation }),
      }
    })
  )
}
