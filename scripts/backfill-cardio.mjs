#!/usr/bin/env node
/**
 * `npm run cardio:backfill` — one-shot import of the legacy
 * `public/data/cardio.json` into Supabase (#152).
 *
 * The cardio dashboard previously read a static JSON file produced by
 * the Apple Health preprocessor. After #152 the source of truth moves
 * to Supabase; this script seeds the new tables from whatever JSON is
 * sitting on disk so existing local data doesn't have to be re-derived
 * from a fresh Apple Health export.
 *
 * Idempotent — uses the same upsert helpers as `import-health.mjs`,
 * so re-running is harmless.
 *
 * Usage:
 *   npm run cardio:backfill
 *   npm run cardio:backfill -- ./path/to/cardio.json   (override path)
 *
 * Exits non-zero on any failure (missing file, schema mismatch,
 * Supabase error). After the backfill succeeds the JSON file can be
 * left in place as a debug artifact (it stays gitignored) or deleted.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CardioDataSchema,
  createServiceRoleClient,
  loadEnv,
  upsertCardioData,
} from './lib/cardio-supabase.mjs'

const DEFAULT_JSON_PATH = path.join('public', 'data', 'cardio.json')

async function main() {
  const argv = process.argv.slice(2)
  const jsonPath = argv[0] ?? DEFAULT_JSON_PATH

  loadEnv()
  const supabase = createServiceRoleClient()

  console.log(`  Reading ${jsonPath}...`)
  const raw = await readFile(jsonPath, 'utf8')
  const parsed = JSON.parse(raw)
  const result = CardioDataSchema.safeParse(parsed)
  if (!result.success) {
    console.error('\n✗ Backfill source failed CardioData validation:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
    }
    throw new Error('Schema mismatch — fix the JSON or re-run the import to regenerate it.')
  }

  const counts = await upsertCardioData(supabase, result.data)
  console.log(
    `✓ Backfilled to Supabase: ${counts.sessions} sessions, ` +
      `${counts.restingHr} resting-HR points, ${counts.vo2max} VO2max points.`,
  )
  if (counts.pruned > 0) {
    console.log(
      `  (Pruned ${counts.pruned} orphan row(s) — present in Supabase but not in this backfill source.)`,
    )
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
