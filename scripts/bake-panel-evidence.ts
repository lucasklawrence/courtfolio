/**
 * Build-time evidence baker (#234, Phase 1). Reads each portfolio project's real
 * source files and writes a serialized {@link EvidenceContext} to
 * `lib/panel/evidence/baked/<slug>.json`.
 *
 * This is the bridge to the public web surface (Phase 2): the Vercel runtime has
 * no repo filesystem, so evidence must be baked here and served from JSON. Run
 * it whenever the judged projects' source changes.
 *
 * Usage: npm run panel:bake
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { repoEvidence } from '../lib/panel/evidence/repo-evidence'
import { PANEL_PROJECTS } from './panel-projects'

const OUT_DIR = path.resolve(process.cwd(), 'lib/panel/evidence/baked')

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  for (const [slug, spec] of Object.entries(PANEL_PROJECTS)) {
    const evidence = await repoEvidence(spec)
    const readable = evidence.artifacts.filter(a => a.excerpt).length
    const dest = path.join(OUT_DIR, `${slug}.json`)
    await writeFile(dest, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    process.stdout.write(
      `baked ${slug}: ${readable}/${spec.paths.length} files → ${path.relative(process.cwd(), dest)}\n`
    )
  }
}

main().catch(err => {
  process.stderr.write(`bake failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
