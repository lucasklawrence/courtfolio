/**
 * Headless judge-panel runner (#234, Phase 0). Reproduces the terminal
 * prototype *as code*: cross-family personas → adversarial verify → meta-judge.
 *
 * Usage:
 *   npm run panel -- --target courtfolio --thesis path/to/thesis.txt
 *   npm run panel -- --target courtfolio --thesis "claim 1 | claim 2 | claim 3"
 *
 * The thesis is either a file path or an inline string with claims separated by
 * "|". Evidence is read live from this repo via the project's spec. Requires
 * AI_GATEWAY_API_KEY (or Vercel OIDC) for the gateway.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { runPanel } from '../lib/panel'
import { portfolioConfig } from '../lib/panel/config'
import { repoEvidence } from '../lib/panel/evidence/repo-evidence'
import type { MetaSynthesis, Thesis } from '../lib/panel/types'
import { PANEL_PROJECTS } from './panel-projects'

/** Minimal flag parser: `--key value` pairs. */
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? ''
  }
  return out
}

/** Resolve the thesis from a file path or an inline `claim | claim | claim` string. */
async function loadThesis(targetId: string, raw: string): Promise<Thesis> {
  const text = existsSync(raw) ? await readFile(raw, 'utf8') : raw
  const claims = text
    .split(/\n|\|/)
    .map(s => s.trim())
    .filter(Boolean)
  if (claims.length === 0) throw new Error('Thesis is empty.')
  return { targetId, claims }
}

/** Print the synthesis in the same shape as the terminal prototype's writeup. */
function printSynthesis(s: MetaSynthesis): void {
  const line = (t: string) => process.stdout.write(`${t}\n`)
  line(`\n🏀  PANEL VERDICT — ${s.targetId}\n`)

  line('Scoreboard:')
  for (const row of s.scoreboard) {
    const scores = row.scores.map(x => `${x.axisId} ${x.score}/10`).join('  ·  ')
    line(`  ${row.label.padEnd(28)} ${scores}`)
  }

  line('\nConvergence:')
  for (const c of s.convergence) line(`  • ${c.finding}  [${c.personaIds.join(', ')}]`)

  line('\nDisagreements (the honest signal):')
  for (const d of s.disagreements) line(`  • ${d.topic} — ${d.honestSignal}`)

  line('\nRobust findings:')
  for (const f of s.robustFindings) line(`  • ${f}`)

  line('\nTop moves:')
  for (const m of s.topMoves) line(`  • ${m}`)

  if (s.caughtErrors.length) {
    line('\n⚠️  Caught panel errors (verifier refuted):')
    for (const e of s.caughtErrors) line(`  • (${e.personaId}) "${e.claim}" — ${e.verifyNote}`)
  }

  line(`\nVerdict: ${s.verdict}\n`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const targetId = args.target
  if (!targetId || !PANEL_PROJECTS[targetId]) {
    throw new Error(`--target must be one of: ${Object.keys(PANEL_PROJECTS).join(', ')}`)
  }
  if (!args.thesis) throw new Error('--thesis <file|inline> is required.')

  const thesis = await loadThesis(targetId, args.thesis)
  const evidence = await repoEvidence(PANEL_PROJECTS[targetId])

  process.stdout.write(
    `Running ${portfolioConfig.personas.length}-persona panel on "${evidence.title}"…\n`
  )
  const result = await runPanel(thesis, evidence, portfolioConfig)
  printSynthesis(result.synthesis)
}

main().catch(err => {
  process.stderr.write(`\nPanel run failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
