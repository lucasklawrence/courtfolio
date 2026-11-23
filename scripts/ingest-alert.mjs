/**
 * File, update or close the GitHub issue that tracks a failing scheduled job.
 *
 * A red scheduled run that nobody looks at is the same as no check at all:
 * three OTF sessions sat broken for 20 days (#334), and the staging sync failed
 * for eleven weeks straight (#478), each time with GitHub's failure email
 * delivered and ignored. This turns a failure into an issue in the tracker,
 * where the work already happens, and keeps it to **one issue per job**:
 *
 * - Failure, no open alert → open `ingest failure: <job>` with the run link,
 *   the failed step and the tail of its log.
 * - Failure, alert already open → comment on it. A daily job failing for a week
 *   produces one issue with seven comments, not seven issues.
 * - Success, alert open → comment that the job recovered, and close it.
 * - Success, no alert → nothing.
 *
 * Open alerts are found by **listing** issues with the alert label, never by
 * the search API: search is eventually consistent, so an issue filed a minute
 * ago can be missing from it, and a dedupe that trusts it files duplicates.
 *
 * Runs as the workflow's separate `alert` job (see `.github/actions/ingest-alert`),
 * which holds `issues: write` and `actions: read` and none of the ingest's
 * secrets. Uses only Node built-ins so that job needs no `npm ci`.
 *
 * Env:
 *   GITHUB_TOKEN       — the job token (issues: write, actions: read)
 *   GITHUB_REPOSITORY  — `owner/repo`, set by Actions
 *   GITHUB_RUN_ID      — set by Actions
 *   GITHUB_SERVER_URL  — set by Actions
 *   ALERT_JOB          — stable job key used in the issue title, e.g. `otbeat-ingest`
 *   JOB_RESULT         — `needs.<job>.result`: success | failure | cancelled | skipped
 */

import { pathToFileURL } from 'node:url'

/** Label that marks an issue as an automated alert rather than planned work. */
export const ALERT_LABEL = 'ingest-failure'

/** Lines of the failed job's log quoted in the alert. */
export const LOG_TAIL_LINES = 40

/** GitHub rejects bodies over 65,536 characters; stay well clear. */
const MAX_LOG_CHARS = 6000

/**
 * The stable title an alert is filed and deduplicated under.
 *
 * @param {string} job Job key, e.g. `otbeat-ingest`.
 */
export function alertTitle(job) {
  return `ingest failure: ${job}`
}

/**
 * Pick the open alert for a job out of a list of issues, or `null`.
 *
 * Matches the title exactly and skips pull requests, which the issues API
 * returns alongside issues. If more than one matches (a duplicate filed by
 * hand, or before this dedupe existed), the oldest wins so every later failure
 * keeps landing in the same thread.
 *
 * @param {ReadonlyArray<{ number: number, title: string, state?: string, pull_request?: unknown }>} issues
 * @param {string} title From {@link alertTitle}.
 * @returns {{ number: number, title: string } | null}
 */
export function findOpenAlert(issues, title) {
  const matches = issues
    .filter(i => !i.pull_request && i.title === title && (i.state ?? 'open') === 'open')
    .sort((a, b) => a.number - b.number)
  return matches[0] ?? null
}

/**
 * What to do for a given job result and the alert currently open, if any.
 *
 * @param {string} result `needs.<job>.result`.
 * @param {{ number: number } | null} open The open alert, from {@link findOpenAlert}.
 * @returns {'create' | 'comment' | 'close' | 'none'}
 */
export function decideAction(result, open) {
  if (result === 'success') return open ? 'close' : 'none'
  // `skipped` means the job never ran because something upstream decided it
  // shouldn't; that is not a failure of the job.
  if (result === 'skipped') return 'none'
  return open ? 'comment' : 'create'
}

/**
 * Keep the last `lines` meaningful lines of an Actions job log.
 *
 * Strips the ISO timestamp Actions prefixes to every line and ANSI colour
 * codes, drops blank lines, and caps the result by length as well as count so
 * one enormous line can't blow the issue body limit. Everything from the first
 * `Post job cleanup.` on is dropped: the runner's teardown follows every
 * failure and would otherwise fill the tail with git config noise.
 *
 * @param {string} log Raw log text from the jobs/{id}/logs endpoint.
 * @param {number} [lines]
 */
export function tailLog(log, lines = LOG_TAIL_LINES) {
  const cleaned = log
    .split(/\r?\n/)
    .map(l => l.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/, ''))
    .map(l => l.replace(/\u001b\[[0-9;]*m/g, ''))
    .filter(l => l.trim() !== '')
  const cleanup = cleaned.findIndex(l => l.startsWith('Post job cleanup.'))
  const body = cleanup === -1 ? cleaned : cleaned.slice(0, cleanup)
  let tail = body.slice(-lines).join('\n')
  if (tail.length > MAX_LOG_CHARS) tail = '…' + tail.slice(-MAX_LOG_CHARS)
  return tail
}

/**
 * Markdown describing one failed run: link, result, failed step, log tail.
 *
 * @param {{ job: string, result: string, runUrl: string, failedStep?: string | null, logTail?: string | null }} run
 */
export function failureDetails({ job, result, runUrl, failedStep, logTail }) {
  const parts = [
    `**${job}** finished with \`${result}\` — [run log](${runUrl})`,
    failedStep ? `Failed step: **${failedStep}**` : null,
    logTail
      ? `<details><summary>Last lines of the log</summary>\n\n\`\`\`\n${logTail.replaceAll('```', "'''")}\n\`\`\`\n\n</details>`
      : '_The log could not be read; open the run for details._',
  ]
  return parts.filter(Boolean).join('\n\n')
}

/**
 * Body for a newly filed alert.
 *
 * @param {Parameters<typeof failureDetails>[0]} run
 */
export function newAlertBody(run) {
  return [
    `The scheduled job \`${run.job}\` failed. This issue was filed automatically and collects every further failure as a comment until a run succeeds, which closes it.`,
    failureDetails(run),
    '_Filed by `scripts/ingest-alert.mjs` (#456)._',
  ].join('\n\n')
}

/**
 * Small GitHub REST client: JSON in, JSON out, errors that say which call failed.
 *
 * @param {string} token
 * @param {string} repo `owner/repo`.
 */
function github(token, repo) {
  const base = `https://api.github.com/repos/${repo}`
  const headers = {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'courtfolio-ingest-alert',
  }
  return {
    async json(method, path, body) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: body ? { ...headers, 'content-type': 'application/json' } : headers,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const err = new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
        err.status = res.status
        throw err
      }
      return res.status === 204 ? null : res.json()
    },
    async text(path) {
      // A job's log can 404 for a few seconds after the job completes, which
      // is exactly when this runs. Retry briefly before giving up on it.
      for (let attempt = 1; ; attempt++) {
        const res = await fetch(`${base}${path}`, { headers })
        if (res.ok) return res.text()
        if (res.status !== 404 || attempt >= 4) throw new Error(`GET ${path}: ${res.status}`)
        await new Promise(resolve => setTimeout(resolve, attempt * 3000))
      }
    },
  }
}

/**
 * The failed job and step of this run, plus the tail of that job's log.
 * Best effort: any error here degrades to an alert without a log.
 *
 * @param {ReturnType<typeof github>} gh
 * @param {string} runId
 */
async function readFailure(gh, runId) {
  try {
    const { jobs } = await gh.json('GET', `/actions/runs/${runId}/jobs?filter=latest&per_page=100`)
    const failed = jobs.find(j => j.conclusion === 'failure' || j.conclusion === 'cancelled')
    if (!failed) return { failedStep: null, logTail: null }
    const step = (failed.steps ?? []).find(
      s => s.conclusion === 'failure' || s.conclusion === 'cancelled'
    )
    const log = await gh.text(`/actions/jobs/${failed.id}/logs`)
    return { failedStep: step?.name ?? null, logTail: tailLog(log) }
  } catch (err) {
    console.warn(`! could not read the failed job's log: ${err.message}`)
    return { failedStep: null, logTail: null }
  }
}

async function main() {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repo,
    GITHUB_RUN_ID: runId,
    GITHUB_SERVER_URL: server = 'https://github.com',
    ALERT_JOB: job,
    JOB_RESULT: result,
  } = process.env
  const missing = Object.entries({
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repo,
    GITHUB_RUN_ID: runId,
    ALERT_JOB: job,
    JOB_RESULT: result,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    console.error(`✗ ingest alert: missing ${missing.join(', ')}`)
    process.exitCode = 2
    return
  }

  const gh = github(token, repo)
  const title = alertTitle(job)
  const runUrl = `${server}/${repo}/actions/runs/${runId}`

  // Listing by label is strongly consistent; 100 open alerts would mean far
  // bigger problems than pagination.
  const issues = await gh.json(
    'GET',
    `/issues?state=open&labels=${encodeURIComponent(ALERT_LABEL)}&per_page=100`
  )
  const open = findOpenAlert(issues, title)
  const action = decideAction(result, open)

  if (action === 'none') {
    console.log(`· ${job}: ${result}, no open alert — nothing to do`)
    return
  }

  if (action === 'close') {
    await gh.json('POST', `/issues/${open.number}/comments`, {
      body: `Recovered: [this run](${runUrl}) of \`${job}\` succeeded. Closing.`,
    })
    await gh.json('PATCH', `/issues/${open.number}`, { state: 'closed', state_reason: 'completed' })
    console.log(`✓ ${job}: recovered — closed #${open.number}`)
    return
  }

  const details = { job, result, runUrl, ...(await readFailure(gh, runId)) }

  if (action === 'comment') {
    await gh.json('POST', `/issues/${open.number}/comments`, {
      body: `Failed again.\n\n${failureDetails(details)}`,
    })
    console.log(`✓ ${job}: ${result} — commented on #${open.number}`)
    return
  }

  // Create the label on first use. 422 means it already exists.
  try {
    await gh.json('POST', '/labels', {
      name: ALERT_LABEL,
      color: 'b60205',
      description: 'Filed automatically when a scheduled job fails (#456)',
    })
  } catch (err) {
    if (err.status !== 422) throw err
  }
  const created = await gh.json('POST', '/issues', {
    title,
    body: newAlertBody(details),
    labels: [ALERT_LABEL],
  })
  console.log(`✓ ${job}: ${result} — filed #${created.number}`)
}

// Only when run as a script, so the helpers can be imported by tests.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error(`✗ ingest alert: ${err.message ?? err}`)
    process.exitCode = 1
  })
}
