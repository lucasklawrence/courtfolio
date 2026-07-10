/**
 * Core type contract for the multi-persona judge panel (issue #234).
 *
 * Everything in `lib/panel` is intentionally UI- and framework-agnostic so the
 * same engine can be lifted into other repos (e.g. the `life` growth-coach,
 * issue #235) by supplying a different {@link PanelConfig} and evidence adapter.
 * Nothing here may import `next/*`, React, or anything courtfolio-specific.
 *
 * The pipeline is: gather {@link EvidenceContext} → run independent
 * {@link PersonaVerdict}s → adversarially {@link VerifiedGap | verify} each
 * grounded claim → {@link MetaSynthesis | synthesize} with a meta-judge.
 */

/**
 * Model vendor family. Personas are spread across disjoint families so the
 * panel doesn't inherit a single model's self-preference bias (the PoLL
 * finding cited in #234).
 */
export type ModelFamily = 'anthropic' | 'openai' | 'google'

/**
 * A single panelist's persona definition — the lens, not a correctness claim.
 * Personas improve *concern coverage and tone*, never factual accuracy (#234
 * research), so the value is the perspective each one is forced to take.
 */
export interface Persona {
  /** Stable identifier, e.g. `hiring-manager`. Used as a map key and in output. */
  id: string
  /** Human-readable name shown in the scoreboard, e.g. `Skeptical Hiring Manager`. */
  label: string
  /** One-line description of the lens this persona judges through. */
  lens: string
  /** System prompt establishing the persona's stance and priorities. */
  systemPrompt: string
  /** Vendor family this persona's model call should use, for cross-family diversity. */
  family: ModelFamily
}

/**
 * A scoring dimension. Portfolio judging uses two ({@link Axis}) — learning-value
 * and portfolio-signal — because conflating them is the most common
 * self-assessment error (#234). Other applications supply their own axes.
 */
export interface Axis {
  /** Stable identifier, e.g. `learning-value`. */
  id: string
  /** Display label, e.g. `Learning value`. */
  label: string
  /** What a high vs. low score on this axis means, given to each panelist. */
  description: string
}

/**
 * The author's claim under test. The mechanic is *gap-finding against this
 * thesis*, not abstract rating — so the thesis is the lever that decides what
 * the panel hunts for. Generic `claims: string[]` (not portfolio-shaped) keeps
 * the engine reusable for decision pressure-testing and the life coach (#235).
 */
export interface Thesis {
  /** Id of the thing being judged (project slug, decision id, …). */
  targetId: string
  /** The claim, as ordered sentences. Portfolio: [what it is, what skill, what proud of]. */
  claims: string[]
}

/**
 * A single grounding artifact excerpt the panel may cite. Kept small and
 * quotable so citations point at something concrete.
 */
export interface EvidenceArtifact {
  /** Source location, e.g. a repo-relative file path or a URL. */
  path: string
  /** A short excerpt of the artifact's content. */
  excerpt: string
  /** Optional note on why this excerpt is relevant. */
  note?: string
}

/**
 * The evidence a panel reasons over. Produced by an evidence adapter
 * (`evidence/*`). Deliberately a self-contained text+excerpt bundle rather than
 * live tool access, so the engine is pure and runs anywhere (including a Vercel
 * runtime with no repo filesystem) — the adapter does any I/O up front.
 */
export interface EvidenceContext {
  /** Id of the judged thing; should match {@link Thesis.targetId}. */
  targetId: string
  /** Display title, e.g. `Courtfolio`. */
  title: string
  /** Human-readable digest the panel reads to ground its judgment. */
  summary: string
  /** Quotable excerpts the panel can cite and the verifier can check against. */
  artifacts: EvidenceArtifact[]
}

/** A persona's score on one {@link Axis}, with its one-line justification. */
export interface AxisScore {
  /** {@link Axis.id} this score is for. */
  axisId: string
  /** Score out of 10. */
  score: number
  /** One-line rationale. */
  rationale: string
}

/**
 * A gap between a thesis claim and what the artifact actually shows — the unit
 * of value the panel produces. Every gap must be grounded in a citation so the
 * verifier can check it (the prototype proved panelists hallucinate grounded-
 * *sounding* claims; see {@link VerifiedGap}).
 */
export interface Gap {
  /** Index into {@link Thesis.claims} this gap pressure-tests, when applicable. */
  claimIndex?: number
  /** The claim, paraphrased. */
  claim: string
  /** What the artifact does or doesn't show, contradicting/qualifying the claim. */
  artifactShows: string
  /** A concrete citation (file path, feature, excerpt) backing the gap. */
  citation: string
  /** The persona's self-rated confidence in this gap, 0–1. */
  confidence: number
}

/** One panelist's complete independent verdict. Produced without seeing peers. */
export interface PersonaVerdict {
  /** {@link Persona.id} that produced this verdict. */
  personaId: string
  /** {@link Persona.label}, denormalized for display. */
  label: string
  /** Score per configured {@link Axis}. */
  scores: AxisScore[]
  /** Gaps this persona found between the thesis and the artifact. */
  gaps: Gap[]
  /** The single thing the author least wants to hear, in this persona's voice. */
  uncomfortableTruth: string
  /** Optional standout positive/negative observation (e.g. strongest moment). */
  standoutObservation?: string
}

/** The verifier's ruling on a single {@link Gap}. */
export type VerifyVerdict = 'upheld' | 'refuted' | 'unverifiable'

/**
 * A {@link Gap} after the adversarial-verify pass. `refuted` gaps are dropped
 * from the synthesis and surfaced as caught errors — this layer is the
 * prototype's key finding (it caught a hallucinated "morph doesn't exist" claim
 * and a real accomplishment misread as "fake").
 */
export interface VerifiedGap extends Gap {
  /** Persona that originally raised the gap. */
  personaId: string
  /**
   * Position of this gap within its persona's gap list. Together with
   * `personaId` it uniquely identifies a gap, so refuting one gap never strips
   * a sibling that happens to cite the same file.
   */
  gapIndex: number
  /** The verifier's ruling. */
  verdict: VerifyVerdict
  /** One-line justification for the ruling, grounded in the evidence. */
  verifyNote: string
}

/** A point where multiple personas independently agreed — high-confidence signal. */
export interface ConvergencePoint {
  /** The shared finding. */
  finding: string
  /** Personas that independently reached it. */
  personaIds: string[]
  /** Supporting citations drawn from the agreeing personas' gaps. */
  citations: string[]
}

/** A point where personas split — per #234, the disagreement is the honest signal. */
export interface DisagreementPoint {
  /** What they disagree about (an axis, or a topic like "does the theme help"). */
  topic: string
  /** Each persona's stance. */
  positions: { personaId: string; stance: string }[]
  /** Why the split itself is informative. */
  honestSignal: string
}

/**
 * The meta-judge's synthesis — the panel's final output. Aggregates independent
 * verdicts (no debate; debate amplifies bias ~8–10%, #234) and weighs the split.
 */
export interface MetaSynthesis {
  /** Id of the judged thing. */
  targetId: string
  /** Per-persona axis scores, for the scoreboard. */
  scoreboard: { personaId: string; label: string; scores: AxisScore[] }[]
  /** Where panelists converged. */
  convergence: ConvergencePoint[]
  /** Where panelists split. */
  disagreements: DisagreementPoint[]
  /** Findings robust enough to act on (ideally thesis-independent). */
  robustFindings: string[]
  /** Highest-leverage recommended moves, in priority order. */
  topMoves: string[]
  /** Gaps the verifier refuted — surfaced so bad claims are visible, not hidden. */
  caughtErrors: { personaId: string; claim: string; verifyNote: string }[]
  /** One-paragraph bottom-line verdict. */
  verdict: string
}

/**
 * Gateway model ids (dotted, e.g. `anthropic/claude-haiku-4.5`) for each role.
 * Centralized so the lineup is trivially editable and verifiable against
 * `GET https://ai-gateway.vercel.sh/v1/models`.
 */
export interface ModelLineup {
  /** Per-family persona model. A persona's {@link Persona.family} selects from here. */
  personas: Record<ModelFamily, string>
  /** Stronger model for the meta-judge synthesis. */
  metaJudge: string
  /** Model for the adversarial-verify pass; a different family adds neutrality. */
  verifier: string
}

/**
 * Per-stage output-token ceilings, passed through to every model call in the
 * stage (#241 cost guard). Omitted fields fall back to the SDK default (no
 * cap). Structured outputs are compact — real persona verdicts run ~300–400
 * output tokens — so caps mainly bound schema-retry worst cases.
 */
export interface StageLimits {
  /** Max output tokens per persona verdict call. */
  personaMaxOutputTokens?: number
  /** Max output tokens per verifier ruling call. */
  verifierMaxOutputTokens?: number
  /** Max output tokens for the meta-judge synthesis call. */
  metaJudgeMaxOutputTokens?: number
}

/**
 * A fully-specified panel run. Bundles the personas, scoring axes, and model
 * lineup. One config per application skin (portfolio, decisions, growth coach).
 */
export interface PanelConfig {
  /** Display name of this configuration. */
  name: string
  /** The panelists. Should span ≥2 model families for diversity. */
  personas: Persona[]
  /** Scoring dimensions every persona reports on. */
  axes: Axis[]
  /** Gateway model ids for each role. */
  lineup: ModelLineup
  /** Optional per-stage output-token ceilings (cost guard for public runs). */
  limits?: StageLimits
}

/**
 * A persona whose model call failed. The run proceeds with the survivors
 * (degradation, not rejection — see {@link PanelRunOptions.minSurvivors}), and
 * the failure is recorded so no output ever pretends the bench was the plan.
 */
export interface PersonaFailure {
  /** {@link Persona.id} whose call failed. */
  personaId: string
  /** Error constructor name only — never the message, which can carry payloads. */
  errorType: string
}

/**
 * Progress events emitted during a run via {@link PanelRunOptions.onEvent}, in
 * pipeline order. Verdict-granular by design: each payload is a *complete*
 * object when it arrives (no partial-object states for consumers to handle).
 */
export type PanelEvent =
  /** A persona's model call settled successfully. */
  | { type: 'persona-verdict'; verdict: PersonaVerdict }
  /** A persona's model call failed; the run continues with the survivors. */
  | { type: 'persona-error'; personaId: string; errorType: string }
  /** The verify stage is starting on `gapCount` gaps. */
  | { type: 'verify-start'; gapCount: number }
  /** One gap's verifier ruling settled (`done` of `total` so far). */
  | {
      type: 'gap-verified'
      personaId: string
      gapIndex: number
      verdict: VerifyVerdict
      done: number
      total: number
    }
  /** The verify stage finished; the complete ruling set. */
  | { type: 'gaps-verified'; verifiedGaps: VerifiedGap[] }

/**
 * Options for a {@link runPanel} run. All optional — the default run is
 * identical to the pre-#241 behavior except that persona failures degrade to
 * survivors instead of rejecting the whole panel.
 */
export interface PanelRunOptions {
  /**
   * Progress listener, called as each stage's units settle. Exceptions thrown
   * by the listener are swallowed — observing a run can never fail it.
   */
  onEvent?: (event: PanelEvent) => void
  /**
   * Cancellation signal, forwarded to every model call. An aborted run throws
   * (`AbortError`/`TimeoutError`); it is never treated as persona degradation.
   */
  signal?: AbortSignal
  /**
   * Minimum surviving persona verdicts required to proceed past stage 1
   * (default 1). A public "panel" surface should demand ≥2 — one surviving
   * model is an opinion, not a panel. Failing the floor throws
   * {@link PanelDegradedError} before any verify/synthesis spend.
   */
  minSurvivors?: number
}

/** The complete result of {@link runPanel}: every stage's output, for display or storage. */
export interface PanelResult {
  /** The thesis that was tested. */
  thesis: Thesis
  /** Each panelist's independent verdict. */
  verdicts: PersonaVerdict[]
  /** Every gap after the verify pass (upheld, refuted, and unverifiable). */
  verifiedGaps: VerifiedGap[]
  /** The meta-judge synthesis. */
  synthesis: MetaSynthesis
  /** Personas that failed and are absent from the verdicts, when any (#241). */
  personaFailures?: PersonaFailure[]
}
