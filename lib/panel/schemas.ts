/**
 * Zod schemas for the structured output of each model call. Passed to the AI
 * SDK's `generateObject`, which forces the model to return a matching object
 * (and retries on mismatch) — so downstream code never parses free text.
 *
 * Schemas cover only the *model-produced* fields. Identity fields
 * (`personaId`/`label`), the scoreboard, and `caughtErrors` are attached
 * deterministically in code from the persona/verify results, keeping the
 * non-judgment parts out of the model's hands.
 */
import { z } from 'zod'

/** A persona's score on one axis. `axisId` must match a configured {@link Axis}. */
export const axisScoreSchema = z.object({
  axisId: z.string().describe('The axis id being scored, exactly as given in the prompt.'),
  score: z.number().min(0).max(10).describe('Score out of 10.'),
  rationale: z.string().describe('One-line justification for the score.'),
})

/** A single gap between a thesis claim and the artifact. */
export const gapSchema = z.object({
  claimIndex: z
    .number()
    .int()
    .nullable()
    .describe('0-based index of the thesis claim this gap tests, or null if cross-cutting.'),
  claim: z.string().describe('The claim being pressure-tested, paraphrased.'),
  artifactShows: z
    .string()
    .describe(
      'What the artifact actually does/does not show, qualifying or contradicting the claim.'
    ),
  citation: z
    .string()
    .describe(
      'A concrete citation (file path, feature, or excerpt) from the evidence backing this gap.'
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Your confidence this gap is real and grounded, 0–1.'),
})

/** The model-produced portion of a {@link PersonaVerdict}. */
export const personaVerdictSchema = z.object({
  scores: z.array(axisScoreSchema).describe('One entry per axis listed in the prompt.'),
  gaps: z
    .array(gapSchema)
    .min(1)
    .max(4)
    .describe('2–4 grounded gaps between the thesis and the artifact.'),
  uncomfortableTruth: z
    .string()
    .describe('The single thing the author least wants to hear, in this persona’s voice.'),
  standoutObservation: z
    .string()
    .nullable()
    .describe('Optional: the single most distinctive thing (positive or negative) you noticed.'),
})

/** Inferred type of {@link personaVerdictSchema}. */
export type PersonaVerdictOutput = z.infer<typeof personaVerdictSchema>

/** The verifier's ruling on one gap. */
export const verifyVerdictSchema = z.object({
  verdict: z
    .enum(['upheld', 'refuted', 'unverifiable'])
    .describe(
      'upheld = the evidence backs the gap; refuted = the evidence contradicts it (claim is wrong); unverifiable = evidence is insufficient to tell.'
    ),
  verifyNote: z.string().describe('One-line justification grounded in the evidence.'),
})

/** Inferred type of {@link verifyVerdictSchema}. */
export type VerifyVerdictOutput = z.infer<typeof verifyVerdictSchema>

/** One convergence point in the synthesis. */
export const convergenceSchema = z.object({
  finding: z.string().describe('The shared finding multiple personas independently reached.'),
  personaIds: z.array(z.string()).describe('Ids of the personas that reached it.'),
  citations: z.array(z.string()).describe('Supporting citations from those personas.'),
})

/** One disagreement point in the synthesis — the honest signal. */
export const disagreementSchema = z.object({
  topic: z.string().describe('What the panelists split on (an axis or a topic).'),
  positions: z
    .array(z.object({ personaId: z.string(), stance: z.string() }))
    .describe('Each persona’s stance on the topic.'),
  honestSignal: z.string().describe('Why the split itself is informative for the author.'),
})

/** The model-produced portion of a {@link MetaSynthesis}. */
export const metaSynthesisSchema = z.object({
  convergence: z.array(convergenceSchema).describe('Where panelists independently agreed.'),
  disagreements: z.array(disagreementSchema).describe('Where panelists split, and why it matters.'),
  robustFindings: z
    .array(z.string())
    .describe(
      'Findings strong enough to act on; prefer ones that would survive a different thesis.'
    ),
  topMoves: z.array(z.string()).describe('Highest-leverage recommended moves, in priority order.'),
  verdict: z.string().describe('One-paragraph bottom-line verdict.'),
})

/** Inferred type of {@link metaSynthesisSchema}. */
export type MetaSynthesisOutput = z.infer<typeof metaSynthesisSchema>
