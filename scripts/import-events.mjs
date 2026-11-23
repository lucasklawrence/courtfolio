#!/usr/bin/env node
/**
 * `npm run import-events` — pull ticket-platform emails (Gametime,
 * Ticketmaster, Eventbrite) from Gmail, parse them, and store them as events
 * in Supabase.
 *
 * Runs headless in CI (`.github/workflows/events-ingest.yml`) on a daily cron,
 * and locally for ad-hoc imports. Same skeleton as the OTbeat importer:
 * an incremental Gmail pull over a lookback window, upsert-only, never prunes,
 * idempotent.
 *
 * Behaviour:
 *  - One Gmail query per platform, over its transactional senders only (see
 *    `PLATFORMS` in `lib/events-parser.mjs`), `newer_than:{N}d` where N
 *    defaults to 14 (override `EVENTS_LOOKBACK_DAYS`). The overlap with the
 *    daily cron means a missed run heals itself.
 *  - Every email from those senders is stored, read or not: one the parser
 *    can't place lands in the `event_emails_review` view rather than being
 *    dropped.
 *  - Already-stored emails are re-read and re-parsed by default, so a parser
 *    fix reaches them. `--skip-stored` fetches only emails not yet in
 *    `event_emails` — for resuming a long backfill that was cut off, since one
 *    run writes everything in a single batch at the end.
 *  - `--dry-run` parses and reports without writing.
 *
 * **The log is public** (this repo's Actions logs are), so it reports counts
 * only — never titles, venues, names or amounts. The rows are in Supabase,
 * readable with the service role.
 *
 * Required env (CI: GitHub secrets → job env; local: `.env.local`):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * One-time backfill: set EVENTS_LOOKBACK_DAYS to reach the oldest ticket
 * email you want covered, e.g. `EVENTS_LOOKBACK_DAYS=<days> npm run import-events`.
 */

import {
  findHtmlPart,
  gmailAccessToken,
  gmailSession,
  headerValue,
  listMessageIds,
  mapLimit,
  resolveLookbackDays,
} from './lib/gmail.mjs'
import { PLATFORMS, parseEventEmail, platformQuery } from './lib/events-parser.mjs'
import {
  createServiceRoleClient,
  loadEnv,
  loadStoredMessageIds,
  upsertEventEmails,
} from './lib/events-supabase.mjs'

const DEFAULT_LOOKBACK_DAYS = 14

/**
 * Gmail GETs in flight at once. Each full GET costs 5 of the 250 quota units
 * a user gets per second, so 4 in flight stays under the limit at any
 * plausible latency; gmailGet backs off if a burst still hits it.
 */
const FETCH_CONCURRENCY = 4

async function main() {
  loadEnv()
  const dryRun = process.argv.includes('--dry-run')
  const skipStored = process.argv.includes('--skip-stored')
  const lookbackDays = resolveLookbackDays('EVENTS_LOOKBACK_DAYS', DEFAULT_LOOKBACK_DAYS)
  // Renews the access token on a 401, so a backfill running past its hour
  // keeps going instead of failing partway.
  const gmail = gmailSession(await gmailAccessToken())

  const ids = new Set()
  for (const platform of PLATFORMS) {
    const found = await listMessageIds(gmail.token, platformQuery(platform, lookbackDays))
    console.log(`  ${platform.id}: ${found.length} email(s) in the last ${lookbackDays}d.`)
    for (const id of found) ids.add(id)
  }

  const supabase = dryRun && !skipStored ? null : createServiceRoleClient()
  let allIds = [...ids]
  if (skipStored) {
    const stored = await loadStoredMessageIds(supabase, allIds)
    allIds = allIds.filter(id => !stored.has(id))
    console.log(`  --skip-stored: ${stored.size} already stored, ${allIds.length} to fetch.`)
  }

  // Fetched a few at a time, so a backfill of a few thousand emails takes
  // minutes rather than outrunning the job; each GET retries rate limits and
  // server errors itself (gmailGet). Each message is parsed as soon as it
  // arrives and only the parsed item is kept, so a backfill never holds every
  // full message in memory. Then every email is planned in ONE batch, oldest
  // first, so an after-the-event email always sees the event its earlier
  // purchase created.
  let gone = 0
  let noHtml = 0
  const fetched = await mapLimit(allIds, FETCH_CONCURRENCY, async id => {
    let msg
    try {
      msg = await gmail.get(`messages/${id}?format=full`)
    } catch (err) {
      if (err.status !== 404) throw err
      gone += 1 // deleted between the list and the GET
      return null
    }
    const html = findHtmlPart(msg.payload)
    if (!html) noHtml += 1
    const receivedAt = new Date(Number(msg.internalDate))
    const subject = headerValue(msg.payload, 'Subject')
    const parsed = parseEventEmail({
      from: headerValue(msg.payload, 'From'),
      subject,
      html: html ?? '',
      receivedAt,
    })
    // A sender outside PLATFORMS matched an extra clause; not ours.
    return parsed ? { messageId: id, subject, receivedAt, parsed } : null
  })
  const items = fetched.filter(Boolean)
  const byKind = {}
  for (const { parsed } of items) {
    const label = `${parsed.platform}/${parsed.kind}`
    byKind[label] = (byKind[label] ?? 0) + 1
  }

  for (const [label, n] of Object.entries(byKind).sort()) console.log(`    ${label}: ${n}`)
  const lowConfidence = items.filter(i => i.parsed.confidence < 0.7).length
  if (noHtml) console.warn(`  ! ${noHtml} email(s) had no text/html part and parsed as empty`)
  if (gone) console.warn(`  ! ${gone} email(s) were deleted before they could be read`)

  if (dryRun) {
    console.log(
      `✓ dry run: parsed ${items.length} email(s), ${lowConfidence} below 0.7 confidence. Nothing written.`
    )
    return
  }

  const summary = await upsertEventEmails(supabase, items)
  console.log(
    `✓ events ingest: wrote ${summary.emails} email(s), ${summary.matched} matched to an event; ` +
      `${summary.newEvents} new event(s), ${summary.filledEvents} filled in. ` +
      `${summary.needsReview} email(s) in event_emails_review.`
  )
  console.log(JSON.stringify(summary))
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
