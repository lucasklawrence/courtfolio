/**
 * Stage 2: adversarial verification. Every grounded gap is re-checked against
 * the same evidence by a separate model. This is the prototype's load-bearing
 * finding: panelists produce confident, grounded-*sounding*, false claims
 * (a hallucinated "the morph doesn't exist", a real accomplishment misread as
 * "fake"), and only checking each claim against the artifact catches them.
 *
 * `refuted` gaps are removed from the synthesis and surfaced as caught errors —
 * visible, not silently dropped.
 */
import { generateStructured } from './models'
import { emitPanelEvent, errorTypeOf, isAbortError } from './events'
import { verifyVerdictSchema } from './schemas'
import type { VerifyVerdictOutput } from './schemas'
import { buildVerifyPrompt } from './prompts'
import type {
  EvidenceContext,
  PanelConfig,
  PanelRunOptions,
  PersonaVerdict,
  VerifiedGap,
} from './types'

/**
 * Verify every gap from every persona, concurrently. Emits `verify-start`,
 * one `gap-verified` per settled ruling, and a final `gaps-verified`.
 *
 * A failed verifier call degrades that gap to the existing `unverifiable`
 * lane (the ruling for "the evidence can't tell") rather than rejecting the
 * whole stage — the gap survives to synthesis unadjudicated, which is the
 * honest reading of "the fact-checker couldn't run" (#241). Cancellation
 * still propagates.
 *
 * @param verdicts the independent persona verdicts
 * @param evidence the sole source of truth the verifier may use
 * @param config supplies the verifier model id and optional stage limits
 * @param opts progress listener, cancellation signal
 * @returns one {@link VerifiedGap} per input gap, tagged with the verifier's ruling
 * @throws only on cancellation (`opts.signal` aborted)
 */
export async function verifyGaps(
  verdicts: PersonaVerdict[],
  evidence: EvidenceContext,
  config: PanelConfig,
  opts: PanelRunOptions = {}
): Promise<VerifiedGap[]> {
  const flat = verdicts.flatMap(v =>
    v.gaps.map((gap, gapIndex) => ({ personaId: v.personaId, gapIndex, gap }))
  )

  emitPanelEvent(opts, { type: 'verify-start', gapCount: flat.length })

  // Shared settle counter for gap-verified progress events. Safe: JS callbacks
  // run one at a time, so increments never interleave.
  let done = 0

  const verifiedGaps = await Promise.all(
    flat.map(async ({ personaId, gapIndex, gap }): Promise<VerifiedGap> => {
      let ruling: VerifyVerdictOutput
      try {
        ruling = await generateStructured<VerifyVerdictOutput>({
          model: config.lineup.verifier,
          system:
            'You are a precise, adversarial fact-checker. You only trust the evidence in front of you.',
          prompt: buildVerifyPrompt(gap, evidence),
          schema: verifyVerdictSchema,
          maxOutputTokens: config.limits?.verifierMaxOutputTokens,
          signal: opts.signal,
        })
      } catch (err) {
        if (opts.signal?.aborted || isAbortError(err)) throw err
        ruling = {
          verdict: 'unverifiable',
          verifyNote: `Verifier unavailable (${errorTypeOf(err)}).`,
        }
      }
      const verified: VerifiedGap = {
        ...gap,
        personaId,
        gapIndex,
        verdict: ruling.verdict,
        verifyNote: ruling.verifyNote,
      }
      done += 1
      emitPanelEvent(opts, {
        type: 'gap-verified',
        personaId,
        gapIndex,
        verdict: verified.verdict,
        done,
        total: flat.length,
      })
      return verified
    })
  )

  emitPanelEvent(opts, { type: 'gaps-verified', verifiedGaps })
  return verifiedGaps
}

/**
 * The set of `personaId|gapIndex` keys the verifier refuted. Keying on the gap's
 * position (not its citation) means refuting one gap can't strip a sibling gap
 * that cites the same file.
 */
function refutedKeys(verifiedGaps: VerifiedGap[]): Set<string> {
  return new Set(
    verifiedGaps.filter(g => g.verdict === 'refuted').map(g => `${g.personaId}|${g.gapIndex}`)
  )
}

/**
 * Return copies of the verdicts with refuted gaps removed — what the meta-judge
 * should synthesize from. Pure; no model calls.
 */
export function stripRefutedGaps(
  verdicts: PersonaVerdict[],
  verifiedGaps: VerifiedGap[]
): PersonaVerdict[] {
  const refuted = refutedKeys(verifiedGaps)
  return verdicts.map(v => ({
    ...v,
    gaps: v.gaps.filter((_g, i) => !refuted.has(`${v.personaId}|${i}`)),
  }))
}

/** The refuted gaps, shaped for {@link MetaSynthesis.caughtErrors}. Pure. */
export function caughtErrors(
  verifiedGaps: VerifiedGap[]
): { personaId: string; claim: string; verifyNote: string }[] {
  return verifiedGaps
    .filter(g => g.verdict === 'refuted')
    .map(g => ({ personaId: g.personaId, claim: g.claim, verifyNote: g.verifyNote }))
}

/** A human-readable list of discarded gaps for the synthesis prompt. Pure. */
export function refutedNote(verifiedGaps: VerifiedGap[]): string {
  return verifiedGaps
    .filter(g => g.verdict === 'refuted')
    .map(g => `- (${g.personaId}) "${g.claim}" — refuted: ${g.verifyNote}`)
    .join('\n')
}
