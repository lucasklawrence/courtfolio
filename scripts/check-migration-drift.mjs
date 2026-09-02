/**
 * Fail when the repo's migrations and the applied ones disagree (#334 follow-up).
 *
 * The gap this closes: a migration's *filename* timestamp and its *applied*
 * version are unrelated. Repo files use a synthetic stamp chosen when the file
 * is written (`20260430120000_cardio_tables.sql`); Supabase records the moment
 * it actually ran (`20260501063801`). So the only thing the two sides share is
 * the name, and nothing was comparing them. Two failure modes went unnoticed
 * for months as a result:
 *
 *   * `create_movement_benchmarks` was applied in April with no file in the
 *     repo, so a rebuild from source silently produced a database missing a
 *     table.
 *   * a migration could sit committed-but-unapplied indefinitely, which is the
 *     shape of the #271 class_type race that left three sessions unusable for
 *     20 days.
 *
 * Comparison is by NAME (the filename with its leading `<digits>_` stripped),
 * because that is the only stable key across the two sides.
 *
 * Usage:
 *   node scripts/check-migration-drift.mjs                    # fail on any drift
 *   node scripts/check-migration-drift.mjs --allow-untracked  # warn, don't fail,
 *                                                            # on applied-with-no-file
 *   node scripts/check-migration-drift.mjs --json             # machine-readable
 *
 * `--allow-untracked` exists for one legitimate case: the convention is to apply
 * a migration *before* committing it, so between applying and merging, a sibling
 * PR's migration is genuinely applied while its .sql file lives on an unmerged
 * branch. Any branch cut from main will report it as untracked through no fault
 * of its own. Committed-but-unapplied (`pending`) is never downgraded — that's
 * the #271 failure mode and always blocks.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY, never the
 * service-role key (see `appliedMigrations`). Exits 0 when in sync, 1 on drift,
 * 2 when it cannot tell — an unreachable database is not a passing check.
 *
 * Talks to PostgREST with plain `fetch` rather than `@supabase/supabase-js`
 * deliberately: the client pulls in a realtime transport that needs a native
 * WebSocket, so constructing it throws outright on Node 20. This check is one
 * unauthenticated-by-RLS read, so it has no use for the client and shouldn't
 * inherit its runtime floor — a drift check that only runs on the newest Node is
 * a drift check that gets skipped.
 */

import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// `@next/env` directly rather than the `loadEnv` re-export in
// `lib/cardio-supabase.mjs`: that module also imports @supabase/supabase-js,
// which this script deliberately doesn't use, and merely importing it emits a
// Node-version deprecation warning that has nothing to do with a drift check.
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')

/**
 * Strip the leading version prefix from a migration filename.
 * `20260430120000_cardio_tables.sql` -> `cardio_tables`
 *
 * @param {string} filename Migration filename.
 * @returns {string} The bare migration name.
 */
export function migrationName(filename) {
  return filename.replace(/\.sql$/, '').replace(/^\d+_/, '')
}

/**
 * Migration names committed to the repo, in filename order.
 * @returns {string[]}
 */
function repoMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(migrationName)
}

/**
 * Migration names recorded as applied, oldest first.
 *
 * Calls the `public.applied_migrations()` RPC rather than selecting the ledger
 * table directly: it lives in `supabase_migrations`, which PostgREST doesn't
 * expose (only `public` and `graphql_public`), so a direct read returns
 * PGRST106. The function is SECURITY DEFINER, returns names only, and is granted
 * to anon — see 20260726120000_applied_migrations_rpc.sql.
 *
 * @returns {Promise<string[]>}
 * @throws {Error} when the env is incomplete or the ledger can't be read.
 */
async function appliedMigrations() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  // The anon key by preference, service-role only as a local fallback. The RPC
  // is granted to anon precisely so this check never needs a privileged
  // credential: CI runs it from a pull-request checkout, and a service-role key
  // there could be exfiltrated by a PR that edits this file — it bypasses RLS
  // entirely and grants writes. The anon key is read-only and bounded by RLS,
  // which is the whole point of the swap. It is still stored as a secret rather
  // than a variable: the training-facility routes that would publish it in a
  // client bundle are flag-gated off in production, so it isn't public today,
  // and this repo's Actions logs are.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be ' +
        'set (.env.local locally, repo variables in CI).'
    )
  }
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/applied_migrations`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: '{}',
  })
  if (!res.ok) {
    throw new Error(`Could not read the migration ledger: ${res.status} ${await res.text()}`)
  }
  const rows = await res.json()
  // `name` is null for very old entries; fall back to the version so a nameless
  // row shows up as an obvious mismatch rather than silently matching "".
  return rows.map(r => r.name || `(unnamed ${r.version})`)
}

/**
 * Compare the two sides.
 *
 * @param {string[]} repo Names committed to the repo.
 * @param {string[]} applied Names recorded as applied.
 * @returns {{ pending: string[], untracked: string[], inSync: boolean }}
 *   `pending` = in the repo but never applied; `untracked` = applied but with no
 *   file, so the repo can't rebuild it.
 */
export function diffMigrations(repo, applied) {
  const appliedSet = new Set(applied)
  const repoSet = new Set(repo)
  const pending = repo.filter(n => !appliedSet.has(n))
  const untracked = applied.filter(n => !repoSet.has(n))
  return { pending, untracked, inSync: pending.length === 0 && untracked.length === 0 }
}

async function main() {
  const asJson = process.argv.includes('--json')
  const allowUntracked = process.argv.includes('--allow-untracked')
  // Same `.env*` precedence Next.js uses, so .env.local supplies the local run.
  loadEnvConfig(process.cwd())

  const repo = repoMigrations()
  let applied
  try {
    applied = await appliedMigrations()
  } catch (err) {
    // Can't-tell is its own exit code: a green check must mean "verified in
    // sync", never "couldn't reach the database".
    console.error(`✗ migration drift check could not run: ${err.message ?? err}`)
    process.exitCode = 2
    return
  }

  const { pending, untracked, inSync } = diffMigrations(repo, applied)
  // `untracked` alone is downgradeable; `pending` always fails.
  const failing = pending.length > 0 || (untracked.length > 0 && !allowUntracked)

  if (asJson) {
    console.log(
      JSON.stringify({ repo, applied, pending, untracked, inSync, failing }, null, 2)
    )
  }

  if (inSync) {
    if (!asJson) console.log(`✓ migrations in sync — ${repo.length} committed, all applied.`)
    return
  }

  if (!asJson) {
    console.error(failing ? '✗ migration drift detected.\n' : '! migration drift (non-fatal).\n')
    if (pending.length > 0) {
      console.error(`  Committed but NOT applied (${pending.length}):`)
      for (const n of pending) console.error(`    - ${n}`)
      console.error(
        '\n  Apply each with the Supabase apply_migration tool (or the CLI) so it\n' +
          '  lands in the ledger. Do not run the SQL through a raw query — that\n' +
          '  changes the schema without recording it, which is how untracked\n' +
          '  migrations appear below.\n'
      )
    }
    if (untracked.length > 0) {
      console.error(`  Applied but NOT in the repo (${untracked.length}):`)
      for (const n of untracked) console.error(`    - ${n}`)
      console.error(
        '\n  Either a sibling PR applied these and has not merged yet — normal,\n' +
          '  re-run once it lands or pass --allow-untracked — or the repo genuinely\n' +
          '  cannot rebuild them, in which case reconstruct each from the live\n' +
          '  schema and commit it named to match the ledger entry, as\n' +
          '  20260429041449_create_movement_benchmarks.sql does.\n'
      )
    }
  }
  if (failing) process.exitCode = 1
}

// Only run when invoked as a script. The unit tests import `diffMigrations` and
// `migrationName` from here; without this guard that import would fire a real
// check — hitting the network and writing to stderr — as a side effect.
const invokedDirectly =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (invokedDirectly) {
  main().catch(err => {
    console.error(err.message ?? err)
    process.exitCode = 2
  })
}
