/**
 * Build-time evidence adapter: read a project's real source files and turn them
 * into an {@link EvidenceContext} so the panel grounds its gap-finding in actual
 * code, not a tagline (the thing that made the #234 prototype land).
 *
 * This does filesystem I/O up front, so the resulting context is a pure,
 * serializable bundle — `scripts/bake-panel-evidence.ts` runs this at build time
 * and writes JSON the runtime can serve without repo access. Never import this
 * from runtime code.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { EvidenceArtifact, EvidenceContext } from '../types'

/** A project to read into evidence. */
export interface RepoProjectSpec {
  /** Id of the project (matches the thesis target). */
  targetId: string
  /** Display title, e.g. `Courtfolio`. */
  title: string
  /** Human-written framing of what the project is (seeds the summary). */
  description: string
  /** Repo-relative file paths whose contents become citable artifacts. */
  paths: string[]
  /** Root the paths resolve against. Defaults to the current working directory. */
  rootDir?: string
  /** Max characters kept per file excerpt. Defaults to 1200. */
  maxExcerptChars?: number
}

/** Truncate a file's content to a budget, marking the cut so the model knows it's partial. */
function excerptOf(content: string, max: number): string {
  if (content.length <= max) return content
  return `${content.slice(0, max)}\n… [truncated, ${content.length - max} more chars]`
}

/**
 * Read the spec's files and assemble an {@link EvidenceContext}. Files that
 * can't be read are recorded as a note rather than throwing, so one moved path
 * doesn't sink a whole bake.
 *
 * @returns evidence whose summary lists the files read and whose artifacts hold
 *   truncated excerpts the panel and verifier can cite
 */
export async function repoEvidence(spec: RepoProjectSpec): Promise<EvidenceContext> {
  const root = spec.rootDir ?? process.cwd()
  const max = spec.maxExcerptChars ?? 1200

  const artifacts: EvidenceArtifact[] = await Promise.all(
    spec.paths.map(async (rel): Promise<EvidenceArtifact> => {
      try {
        const content = await readFile(path.resolve(root, rel), 'utf8')
        return { path: rel, excerpt: excerptOf(content, max) }
      } catch {
        return { path: rel, excerpt: '', note: 'unreadable (missing or moved)' }
      }
    })
  )

  const readCount = artifacts.filter(a => a.excerpt).length
  const summary = [
    spec.description,
    ``,
    `Evidence below is drawn from ${readCount} of ${spec.paths.length} real source files in the project repo.`,
  ].join('\n')

  return { targetId: spec.targetId, title: spec.title, summary, artifacts }
}
