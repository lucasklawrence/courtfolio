/**
 * Record that a scheduled ingest completed: one row in `ingest_runs`.
 *
 * This is the heartbeat half of #456. An `if: failure()` alert can only fire
 * when a run exists, and the failure most likely to repeat #334's 20-day gap
 * is the run that never happens: GitHub disables schedules after 60 days of
 * repo inactivity, drops scheduled runs under load, and a valid-but-wrong cron
 * edit never fires. A watcher outside GitHub (a Grafana alert on
 * `max(ran_at)`) catches all three, but only if every successful run leaves a
 * timestamp behind. This writes it.
 *
 * Run it as the **last** step of the ingest job, so a row means the whole job
 * succeeded, not just that it started.
 *
 * Usage: node scripts/record-ingest-run.mjs <job>
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — the same production
 *     write credentials the ingest step already uses. `ingest_runs` has RLS on
 *     and no policies, so only the service role can write it.
 *   GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID — optional; set by
 *     Actions, used to link the row to its run.
 */

import { pathToFileURL } from 'node:url'

/**
 * The row to insert for one completed run.
 *
 * @param {string} job Stable job key, e.g. `otbeat-ingest`.
 * @param {Record<string, string | undefined>} env Usually `process.env`.
 * @returns {{ job: string, run_url: string | null }}
 */
export function ingestRunRow(job, env) {
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId } = env
  return {
    job,
    run_url: server && repo && runId ? `${server}/${repo}/actions/runs/${runId}` : null,
  }
}

async function main() {
  const job = process.argv[2]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!job || !url || !key) {
    console.error(
      '✗ record-ingest-run: usage `node scripts/record-ingest-run.mjs <job>` with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set'
    )
    process.exitCode = 2
    return
  }

  const res = await fetch(`${url}/rest/v1/ingest_runs`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(ingestRunRow(job, process.env)),
  })
  if (!res.ok) {
    console.error(`✗ record-ingest-run ${job}: ${res.status} ${await res.text()}`)
    process.exitCode = 1
    return
  }
  console.log(`✓ heartbeat recorded for ${job}`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error(`✗ record-ingest-run: ${err.message ?? err}`)
    process.exitCode = 1
  })
}
