/**
 * Stage 1: independent persona fan-out. Each persona judges in parallel and in
 * isolation — no debate, no shared context. Independence is the point: naive
 * multi-agent debate amplifies bias ~8–10% while independent-then-aggregate
 * stays near baseline (#234).
 *
 * Failure semantics (#241): one persona's model call failing benches that
 * persona instead of rejecting the whole panel — the run proceeds with the
 * survivors and records a {@link PersonaFailure} per bench. Cancellation
 * (abort/timeout) is not degradation and always propagates.
 */
import { generateStructured } from './models'
import { emitPanelEvent, errorTypeOf, isAbortError } from './events'
import { personaVerdictSchema } from './schemas'
import type { PersonaVerdictOutput } from './schemas'
import { buildPersonaPrompt } from './prompts'
import type {
  EvidenceContext,
  Gap,
  PanelConfig,
  PanelRunOptions,
  PersonaFailure,
  PersonaVerdict,
  Thesis,
} from './types'

/**
 * Thrown by {@link runPanel} when fewer personas survive stage 1 than
 * {@link PanelRunOptions.minSurvivors} requires — before any verify/synthesis
 * spend. Carries the outcome so callers can report *which* personas failed.
 */
export class PanelDegradedError extends Error {
  /** The verdicts that did survive. */
  readonly verdicts: PersonaVerdict[]
  /** The personas that failed. */
  readonly failures: PersonaFailure[]

  constructor(verdicts: PersonaVerdict[], failures: PersonaFailure[], minSurvivors: number) {
    super(
      `Panel degraded below the survivor floor: ${verdicts.length} of ${
        verdicts.length + failures.length
      } personas survived (minimum ${minSurvivors}).`
    )
    this.name = 'PanelDegradedError'
    this.verdicts = verdicts
    this.failures = failures
  }
}

/** Stage-1 outcome: the surviving verdicts plus a record of every bench. */
export interface PersonaPanelOutcome {
  /** Surviving verdicts, in config order. */
  verdicts: PersonaVerdict[]
  /** Personas whose model call failed, in config order. */
  failures: PersonaFailure[]
}

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
 * Emits `persona-verdict` / `persona-error` events as each call settles.
 *
 * @param thesis the claim under test
 * @param evidence the grounding all personas reason from
 * @param config personas, axes, the model lineup, and optional stage limits
 * @param opts progress listener, cancellation signal
 * @returns surviving verdicts + recorded failures, each in config order
 * @throws only on cancellation (`opts.signal` aborted) — model failures bench
 *   the persona instead
 */
export async function runPersonaPanel(
  thesis: Thesis,
  evidence: EvidenceContext,
  config: PanelConfig,
  opts: PanelRunOptions = {}
): Promise<PersonaPanelOutcome> {
  const prompt = buildPersonaPrompt(thesis, evidence, config.axes)

  const settled = await Promise.all(
    config.personas.map(
      async (persona): Promise<{ verdict?: PersonaVerdict; failure?: PersonaFailure }> => {
        try {
          const out = await generateStructured<PersonaVerdictOutput>({
            model: config.lineup.personas[persona.family],
            system: persona.systemPrompt,
            prompt,
            schema: personaVerdictSchema,
            maxOutputTokens: config.limits?.personaMaxOutputTokens,
            signal: opts.signal,
          })
          const verdict: PersonaVerdict = {
            personaId: persona.id,
            label: persona.label,
            scores: out.scores,
            gaps: out.gaps.map(toGap),
            uncomfortableTruth: out.uncomfortableTruth,
            ...(out.standoutObservation === null
              ? {}
              : { standoutObservation: out.standoutObservation }),
          }
          emitPanelEvent(opts, { type: 'persona-verdict', verdict })
          return { verdict }
        } catch (err) {
          // Cancellation is not degradation: an aborted run must throw, never
          // masquerade as a benched persona.
          if (opts.signal?.aborted || isAbortError(err)) throw err
          const failure: PersonaFailure = { personaId: persona.id, errorType: errorTypeOf(err) }
          emitPanelEvent(opts, { type: 'persona-error', ...failure })
          return { failure }
        }
      }
    )
  )

  return {
    verdicts: settled.flatMap(s => (s.verdict ? [s.verdict] : [])),
    failures: settled.flatMap(s => (s.failure ? [s.failure] : [])),
  }
}
