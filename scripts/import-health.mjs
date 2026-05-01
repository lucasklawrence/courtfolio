#!/usr/bin/env node
/**
 * `npm run import-health -- <export.zip>` — Apple Health → Supabase
 * cardio pipeline (PRD §7.3, #152).
 *
 * 1. Spawns Python (`scripts/preprocess-health.py`) to read the Apple
 *    Health export and emit an intermediate JSON file
 *    (`public/data/cardio.json`, gitignored).
 * 2. Validates the JSON against a Zod mirror of `CardioData`. Drift
 *    between the Python output shape and the TypeScript type fails
 *    loudly here instead of silently breaking the dashboard at runtime.
 * 3. Upserts every session, resting-HR point, and VO2max point into
 *    Supabase via the service-role key. Idempotent — re-running after
 *    a fresh Apple Health export overwrites the same primary keys
 *    rather than duplicating rows.
 *
 * Exits non-zero on any failure (Python error, missing file, schema
 * mismatch, Supabase error). Stdout/stderr from Python is forwarded
 * to the user so they see the parse log.
 *
 * Skip the Python step (re-upsert from an already-produced JSON) with
 * `--from-json=<path>` — useful for retrying just the Supabase write
 * after a transient connection failure.
 */

import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  CardioDataSchema,
  createServiceRoleClient,
  loadEnv,
  upsertCardioData,
} from './lib/cardio-supabase.mjs'

const PYTHON_SCRIPT = path.join('scripts', 'preprocess-health.py')
const DEFAULT_OUTPUT_PATH = path.join('public', 'data', 'cardio.json')

/**
 * Pick the right Python interpreter. `python` is more universal; falls
 * back to `python3` if the user's PATH only has the versioned name.
 */
function pythonExecutable() {
  return process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
}

function usage() {
  console.error(
    'Usage: npm run import-health -- <export.zip|export.xml> [--max-hr=185] [--from-json=<path>]',
  )
  process.exit(1)
}

async function runPython(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable(), [PYTHON_SCRIPT, ...args], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Python preprocess-health.py exited with code ${code}`))
    })
  })
}

async function validateJson(jsonPath) {
  const raw = await readFile(jsonPath, 'utf8')
  const parsed = JSON.parse(raw)
  const result = CardioDataSchema.safeParse(parsed)
  if (!result.success) {
    console.error('\n✗ cardio.json failed CardioData validation:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
    }
    throw new Error('Schema mismatch — check `types/cardio.ts` against `preprocess-health.py` output.')
  }
  return result.data
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length === 0) usage()

  let fromJson
  const passthrough = []
  for (const arg of argv) {
    if (arg.startsWith('--from-json=')) {
      fromJson = arg.slice('--from-json='.length)
    } else {
      passthrough.push(arg)
    }
  }

  loadEnv()
  const supabase = createServiceRoleClient()

  let jsonPath
  if (fromJson) {
    jsonPath = fromJson
    console.log(`  Skipping Python preprocess; reading ${jsonPath}`)
  } else {
    if (passthrough.length === 0) usage()
    jsonPath = DEFAULT_OUTPUT_PATH
    await runPython([passthrough[0], jsonPath, ...passthrough.slice(1)])
  }

  const data = await validateJson(jsonPath)
  const counts = await upsertCardioData(supabase, data)
  console.log(
    `✓ Upserted to Supabase: ${counts.sessions} sessions, ` +
      `${counts.restingHr} resting-HR points, ${counts.vo2max} VO2max points.`,
  )
  if (counts.pruned > 0) {
    console.log(
      `  (Pruned ${counts.pruned} orphan row(s) — present in Supabase but not in this import.)`,
    )
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
