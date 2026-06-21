/**
 * Simplest evidence adapter: wrap a curated text description (and optional
 * excerpts) as an {@link EvidenceContext}. Use when there's no machine-readable
 * artifact to read — a decision write-up, an external project, a draft email.
 */
import type { EvidenceArtifact, EvidenceContext } from '../types'

/**
 * Build an {@link EvidenceContext} from a plain summary and optional artifacts.
 *
 * @param targetId id of the thing being judged (matches the thesis)
 * @param title display title
 * @param summary the digest the panel reasons over
 * @param artifacts optional citable excerpts
 */
export function textEvidence(
  targetId: string,
  title: string,
  summary: string,
  artifacts: EvidenceArtifact[] = []
): EvidenceContext {
  return { targetId, title, summary, artifacts }
}
