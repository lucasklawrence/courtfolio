#!/usr/bin/env node
/**
 * `npm run import-otbeat` — pull recent Orangetheory "OTbeatReport" summary
 * emails from Gmail, parse them, and append new sessions to Supabase
 * `otf_sessions` (#251).
 *
 * Runs headless in CI (`.github/workflows/otbeat-ingest.yml`) on a weekly
 * cron, and locally for ad-hoc imports. Gmail access uses a refresh-token
 * OAuth flow over native `fetch` — no Google SDK dependency. The Supabase
 * write reuses the cardio import's service-role client.
 *
 * Behaviour:
 *  - Queries `from:OTbeatReport@orangetheoryfitness.com newer_than:{N}d`,
 *    where N (default 8, override `OTBEAT_LOOKBACK_DAYS`) is wider than the
 *    weekly cron so a missed run self-heals via the overlap.
 *  - Reads each match's `text/html` body (the tread/rower stats live only
 *    there), parses it, and append-only upserts (dedupe by `started_at`,
 *    never prunes — see `upsertOtfSessions`).
 *  - Idempotent: re-running over the overlap window adds 0.
 *
 * Required env (CI: GitHub secrets → job env; local: `.env.local`):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * For a full historical backfill, widen the window, e.g.
 *   OTBEAT_LOOKBACK_DAYS=3650 npm run import-otbeat
 */

import { parseOtbeatHtml } from './lib/otbeat-parser.mjs'
import { createServiceRoleClient, loadEnv, upsertOtfSessions } from './lib/otbeat-supabase.mjs'

const OTBEAT_SENDER = 'OTbeatReport@orangetheoryfitness.com'
const DEFAULT_LOOKBACK_DAYS = 8

/** Read a required env var or throw a clear, actionable error. */
function requireEnv(name) {
  const v = process.env[name]?.trim()
  if (!v) {
    throw new Error(
      `${name} is not set. In CI add it as a GitHub secret; locally add it to .env.local.`
    )
  }
  return v
}

/** Per-request timeout for Gmail HTTP calls, so a stalled request can't run out the CI job clock. */
const HTTP_TIMEOUT_MS = 30_000

/** `fetch` with an {@link HTTP_TIMEOUT_MS} abort, so a hung token/API call fails fast instead of hanging. */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Exchange the long-lived Gmail refresh token for a short-lived access token.
 * @returns {Promise<string>} OAuth2 access token.
 */
async function gmailAccessToken() {
  const res = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GMAIL_CLIENT_ID'),
      client_secret: requireEnv('GMAIL_CLIENT_SECRET'),
      refresh_token: requireEnv('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json()
  if (!json.access_token) throw new Error('Gmail token refresh returned no access_token')
  return json.access_token
}

/** GET a Gmail REST endpoint (path relative to `users/me/`) as JSON. */
async function gmailGet(pathAndQuery, token) {
  const res = await fetchWithTimeout(
    `https://gmail.googleapis.com/gmail/v1/users/me/${pathAndQuery}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) {
    throw new Error(`Gmail GET ${pathAndQuery} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

/** Decode a Gmail base64url message-part body to a UTF-8 string. */
function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

/** Depth-first search a Gmail payload tree for the first `text/html` part. */
function findHtmlPart(payload) {
  if (payload?.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  for (const part of payload?.parts ?? []) {
    const found = findHtmlPart(part)
    if (found) return found
  }
  return null
}

/** List all OTbeat message IDs within the lookback window (paginated). */
async function listMessageIds(token, lookbackDays) {
  const q = encodeURIComponent(`from:${OTBEAT_SENDER} newer_than:${lookbackDays}d`)
  const ids = []
  let pageToken = ''
  do {
    const page = await gmailGet(
      `messages?q=${q}&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
      token
    )
    for (const m of page.messages ?? []) ids.push(m.id)
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return ids
}

/**
 * Resolve the Gmail lookback window from `OTBEAT_LOOKBACK_DAYS`, defaulting to
 * {@link DEFAULT_LOOKBACK_DAYS}. Rejects non-positive / non-integer values
 * rather than letting `Number()` coerce them into a `newer_than:NaNd` /
 * `newer_than:0d` query that silently returns the wrong window.
 */
function resolveLookbackDays() {
  const raw = process.env.OTBEAT_LOOKBACK_DAYS
  if (raw == null || raw.trim() === '') return DEFAULT_LOOKBACK_DAYS
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `OTBEAT_LOOKBACK_DAYS must be a positive integer (days); got ${JSON.stringify(raw)}`
    )
  }
  return n
}

async function main() {
  loadEnv()
  const lookbackDays = resolveLookbackDays()

  const token = await gmailAccessToken()
  const ids = await listMessageIds(token, lookbackDays)
  console.log(`  Found ${ids.length} OTbeat email(s) in the last ${lookbackDays}d.`)

  const records = []
  for (const id of ids) {
    const msg = await gmailGet(`messages/${id}?format=full`, token)
    const html = findHtmlPart(msg.payload)
    if (!html) {
      console.warn(`  ! message ${id} has no text/html part — skipping`)
      continue
    }
    const rec = parseOtbeatHtml(html)
    // Require the workout-summary signal — date + time + the MINUTES/ZONE
    // block — so a non-summary email from the same sender can't slip through
    // as a mostly-null otf_sessions row.
    if (!rec.date || !rec.time || !rec.zones_min) {
      console.warn(`  ! message ${id} isn't a parseable workout summary — skipping`)
      continue
    }
    records.push(rec)
  }

  const supabase = createServiceRoleClient()
  const summary = await upsertOtfSessions(supabase, records)
  console.log(
    `✓ otbeat ingest: added ${summary.added}, skipped ${summary.skipped} ` +
      `(already present), ${summary.total} total in otf_sessions.`
  )
  console.log(JSON.stringify(summary))
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
