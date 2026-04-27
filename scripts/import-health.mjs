#!/usr/bin/env node
/**
 * `npm run import-health -- <export.zip>` wrapper around
 * `scripts/preprocess-health.py` (PRD §7.3).
 *
 * 1. Spawns Python to read the Apple Health export and emit
 *    `public/data/cardio.json`.
 * 2. Validates the emitted JSON against a Zod mirror of `CardioData`
 *    (`types/cardio.ts`). Drift between the Python output shape and
 *    the TypeScript type fails loudly here instead of silently
 *    breaking the dashboard at runtime.
 *
 * Exits non-zero on any failure (Python error, missing file, schema
 * mismatch). Stdout/stderr from Python is forwarded to the user so
 * they see the parse log.
 */

import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const PYTHON_SCRIPT = path.join('scripts', 'preprocess-health.py')
const OUTPUT_PATH = path.join('public', 'data', 'cardio.json')

/**
 * Zod mirror of `CardioData` from `types/cardio.ts`. Kept in sync
 * manually — when the TS type changes, update this and the Python
 * script. The wrapper's whole reason to exist is to catch the case
 * where you forgot one of the two.
 */
const HrZoneSecondsSchema = z
  .object({
    '1': z.number().nonnegative(),
    '2': z.number().nonnegative(),
    '3': z.number().nonnegative(),
    '4': z.number().nonnegative(),
    '5': z.number().nonnegative(),
  })
  .strict()

const CardioSessionSchema = z
  .object({
    date: z.string().min(1),
    activity: z.enum(['stair', 'running', 'walking']),
    duration_seconds: z.number().nonnegative(),
    distance_meters: z.number().nonnegative().nullable().optional(),
    avg_hr: z.number().nonnegative().nullable().optional(),
    max_hr: z.number().nonnegative().nullable().optional(),
    pace_seconds_per_km: z.number().nonnegative().nullable().optional(),
    hr_seconds_in_zone: HrZoneSecondsSchema.nullable().optional(),
    meters_per_heartbeat: z.number().nonnegative().nullable().optional(),
  })
  .strict()

const CardioTimePointSchema = z
  .object({
    date: z.string().min(1),
    value: z.number(),
  })
  .strict()

const CardioDataSchema = z
  .object({
    imported_at: z.string().min(1),
    sessions: z.array(CardioSessionSchema),
    resting_hr_trend: z.array(CardioTimePointSchema),
    vo2max_trend: z.array(CardioTimePointSchema),
  })
  .strict()

/**
 * Pick the right Python interpreter. `python` is more universal; falls
 * back to `python3` if the user's PATH only has the versioned name.
 */
function pythonExecutable() {
  return process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
}

function usage() {
  console.error('Usage: npm run import-health -- <export.zip|export.xml> [--max-hr=185]')
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

async function validateOutput() {
  const raw = await readFile(OUTPUT_PATH, 'utf8')
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

  await runPython([argv[0], OUTPUT_PATH, ...argv.slice(1)])
  const data = await validateOutput()
  console.log(
    `✓ ${OUTPUT_PATH} validates as CardioData ` +
      `(${data.sessions.length} sessions, ${data.resting_hr_trend.length} resting-HR points, ` +
      `${data.vo2max_trend.length} VO2max points).`,
  )
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
