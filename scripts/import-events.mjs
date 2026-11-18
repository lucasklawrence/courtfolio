#!/usr/bin/env node
/**
 * `npm run import-events` — pull ticket-platform emails (Gametime,
 * Ticketmaster, Eventbrite) from Gmail, parse them, and store them as events
 * in Supabase (#502).
 *
 * Runs headless in CI (`.github/workflows/events-ingest.yml`) on a daily cron,
 * and locally for ad-hoc imports. Same skeleton as the OTbeat importer (#251):
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
  gmailGet,
  headerValue,
  listMessageIds,
  resolveLookbackDays,
} from './lib/gmail.mjs'
import { PLATFORMS, parseEventEmail, platformQuery } from './lib/events-parser.mjs'
import { createServiceRoleClient, loadEnv, upsertEventEmails } from './lib/events-supabase.mjs'

const DEFAULT_LOOKBACK_DAYS = 14

async function main() {
  loadEnv()
  const dryRun = process.argv.includes('--dry-run')
  const lookbackDays = resolveLookbackDays('EVENTS_LOOKBACK_DAYS', DEFAULT_LOOKBACK_DAYS)
  const token = await gmailAccessToken()

  const ids = new Set()
  for (const platform of PLATFORMS) {
    const found = await listMessageIds(token, platformQuery(platform, lookbackDays))
    console.log(`  ${platform.id}: ${found.length} email(s) in the last ${lookbackDays}d.`)
    for (const id of found) ids.add(id)
  }

  const items = []
  const byKind = {}
  let noHtml = 0
  for (const id of ids) {
    const msg = await gmailGet(`messages/${id}?format=full`, token)
    const html = findHtmlPart(msg.payload)
    if (!html) noHtml += 1
    const receivedAt = new Date(Number(msg.internalDate))
    const parsed = parseEventEmail({
      from: headerValue(msg.payload, 'From'),
      subject: headerValue(msg.payload, 'Subject'),
      html: html ?? '',
      receivedAt,
    })
    if (!parsed) continue // a sender outside PLATFORMS matched an extra clause; not ours
    items.push({ messageId: id, subject: headerValue(msg.payload, 'Subject'), receivedAt, parsed })
    const label = `${parsed.platform}/${parsed.kind}`
    byKind[label] = (byKind[label] ?? 0) + 1
  }

  for (const [label, n] of Object.entries(byKind).sort()) console.log(`    ${label}: ${n}`)
  const lowConfidence = items.filter(i => i.parsed.confidence < 0.7).length
  if (noHtml) console.warn(`  ! ${noHtml} email(s) had no text/html part and parsed as empty`)

  if (dryRun) {
    console.log(
      `✓ dry run: parsed ${items.length} email(s), ${lowConfidence} below 0.7 confidence. Nothing written.`
    )
    return
  }

  const supabase = createServiceRoleClient()
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
