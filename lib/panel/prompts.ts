/**
 * Pure prompt builders for each pipeline stage. No I/O, no model calls — these
 * are deterministic string functions so they can be unit-tested directly and
 * reasoned about without mocking.
 *
 * The shared mechanic encoded here: the panel pressure-tests *the thesis* against
 * *the evidence*, finding gaps between claim and artifact (never rating quality
 * in the abstract — that's the #234 design).
 */
import type { Axis, EvidenceContext, Gap, PersonaVerdict, Thesis } from './types'

/** Render thesis claims as a 0-indexed list so the model's `claimIndex` lines up. */
function renderClaims(thesis: Thesis): string {
  return thesis.claims.map((c, i) => `Claim [${i}]: ${c}`).join('\n')
}

/** Render the evidence digest plus citable artifact excerpts. */
function renderEvidence(evidence: EvidenceContext): string {
  const artifacts = evidence.artifacts
    .map(
      a => `- ${a.path}${a.note ? ` (${a.note})` : ''}:\n    ${a.excerpt.replace(/\n/g, '\n    ')}`
    )
    .join('\n')
  return `# Evidence for "${evidence.title}"\n\n${evidence.summary}\n\n## Citable artifacts\n${artifacts || '(none)'}`
}

/** Render the configured axes the persona must score. */
function renderAxes(axes: Axis[]): string {
  return axes.map(a => `- ${a.id} ("${a.label}"): ${a.description}`).join('\n')
}

/**
 * Build the per-persona task prompt. The persona's stance lives in its system
 * prompt ({@link Persona.systemPrompt}); this is the shared task body.
 *
 * @param thesis the author's claim under test
 * @param evidence the grounding the persona must reason from (no live tools)
 * @param axes the dimensions to score
 */
export function buildPersonaPrompt(
  thesis: Thesis,
  evidence: EvidenceContext,
  axes: Axis[]
): string {
  return [
    `You are one panelist on an INDEPENDENT judge panel. You do NOT see other panelists and must NOT debate — judge independently and honestly.`,
    ``,
    `The author of "${evidence.title}" states this thesis. Your job is GAP-FINDING: where does the EVIDENCE fail to back the CLAIM, seen through your persona's lens? Do not rate quality in the abstract.`,
    ``,
    `## Thesis`,
    renderClaims(thesis),
    ``,
    renderEvidence(evidence),
    ``,
    `## Score on these axes (0–10 each)`,
    renderAxes(axes),
    ``,
    `## Rules`,
    `- Ground every gap in a specific citation from the evidence above. If you can't cite it, don't claim it.`,
    `- 2–4 gaps. Each must name what the artifact actually shows, not a generic concern.`,
    `- Set "claimIndex" to the 0-based claim a gap tests, or null if it cuts across claims.`,
    `- Be honest and specific. Your value is the perspective you're forced to take, not flattery.`,
  ].join('\n')
}

/**
 * Build the verifier prompt for a single gap. The verifier re-checks the gap
 * against the same evidence the persona had — this is the layer that catches
 * grounded-*sounding* hallucinations (the prototype's key finding).
 *
 * @param gap the claim to adjudicate
 * @param evidence the only source of truth the verifier may use
 */
export function buildVerifyPrompt(gap: Gap, evidence: EvidenceContext): string {
  return [
    `You are an adversarial fact-checker. A panelist made the claim below about "${evidence.title}". Using ONLY the evidence provided, decide whether the evidence backs it.`,
    ``,
    `## Panelist's gap`,
    `- Claim tested: ${gap.claim}`,
    `- What they say the artifact shows: ${gap.artifactShows}`,
    `- Their citation: ${gap.citation}`,
    ``,
    renderEvidence(evidence),
    ``,
    `## Rules`,
    `- "refuted" ONLY if the evidence positively contradicts the gap (the panelist is wrong).`,
    `- "upheld" if the evidence supports it. "unverifiable" if the evidence is insufficient to tell.`,
    `- Default to "unverifiable" over "upheld" when the citation can't be located in the evidence.`,
    `- Judge the gap's factual basis, not whether it's an important critique.`,
  ].join('\n')
}

/** Compact, citation-preserving render of one verdict for the synthesis prompt. */
function renderVerdict(v: PersonaVerdict): string {
  const scores = v.scores.map(s => `${s.axisId}=${s.score}`).join(', ')
  const gaps = v.gaps.map(g => `    • [${g.citation}] ${g.claim} → ${g.artifactShows}`).join('\n')
  return [
    `### ${v.label} (${v.personaId})`,
    `Scores: ${scores}`,
    `Gaps:\n${gaps}`,
    `Uncomfortable truth: ${v.uncomfortableTruth}`,
    v.standoutObservation ? `Standout: ${v.standoutObservation}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Build the meta-judge synthesis prompt. The meta-judge aggregates *independent*
 * verdicts (no debate — debate amplifies bias, #234) and is explicitly told the
 * disagreement is the most honest signal.
 *
 * Refuted gaps are stripped before synthesis; their list is passed separately so
 * the meta-judge knows what was discarded and why.
 *
 * @param thesis the claim under test
 * @param verdicts the independent panelist verdicts (with refuted gaps removed)
 * @param refutedNote a human-readable list of gaps the verifier threw out
 * @param absenceNote one-line note when personas are benched (failed model
 *   calls), so the meta-judge synthesizes from the verdicts that exist rather
 *   than inventing the missing perspectives (empty when the panel is whole)
 */
export function buildSynthesisPrompt(
  thesis: Thesis,
  verdicts: PersonaVerdict[],
  refutedNote: string,
  absenceNote = ''
): string {
  return [
    `You are the meta-judge. Synthesize these INDEPENDENT panelist verdicts into one honest assessment. Do not average away disagreement — where panelists split, the split itself is the most honest signal, so surface it.`,
    ``,
    `## Thesis under test`,
    renderClaims(thesis),
    ``,
    `## Panelist verdicts (refuted gaps already removed)`,
    verdicts.map(renderVerdict).join('\n\n'),
    ...(absenceNote ? [``, `## Panel note`, absenceNote] : []),
    ``,
    `## Gaps the fact-checker discarded`,
    refutedNote || '(none)',
    ``,
    `## Produce`,
    `- convergence: findings ≥2 personas independently reached (cite them).`,
    `- disagreements: where they split, each persona's stance, and why the split is informative.`,
    `- robustFindings: prefer findings that would survive a *different* thesis about the same artifact.`,
    `- topMoves: the highest-leverage changes, in priority order.`,
    `- verdict: one honest paragraph.`,
  ].join('\n')
}
