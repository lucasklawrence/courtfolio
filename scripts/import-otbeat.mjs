#!/usr/bin/env node
/**
 * `npm run import-otbeat` — pull recent Orangetheory "OTbeatReport" summary
 * emails from Gmail, parse them, and append new sessions to Supabase
 * `otf_sessions` (#251).
 *
 * Runs headless in CI (`.github/workflows/otbeat-ingest.yml`) on a weekly
 * cron, and locally for ad-hoc imports. Gmail access is the shared
 * refresh-token client in `lib/gmail.mjs` — no Google SDK dependency. The Supabase
 * write reuses the cardio import's service-role client.
 *
 * Behaviour:
 *  - Queries `from:OTbeatReport@orangetheoryfitness.com newer_than:{N}d`,
 *    where N (default 8, override `OTBEAT_LOOKBACK_DAYS`) is wider than the
 *    weekly cron so a missed run self-heals via the overlap.
 *  - Reads each match's `text/html` body (the tread/rower stats live only
 *    there), parses it, and append-only upserts (dedupe by `started_at`,
 *    never prunes — see `upsertOtfSessions`), backfilling a null `class_type`
 *    on rows already present.
 *  - Idempotent: re-running over the overlap window adds 0.
 *  - **Exits 1** when any counted session still lacks a `class_type` — such a
 *    row matches no filter chip in the OTF view and reads as a missing workout,
 *    so the run fails rather than letting the drift go unseen.
 *
 * Required env (CI: GitHub secrets → job env; local: `.env.local`):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * For a full historical backfill, widen the window, e.g.
 *   OTBEAT_LOOKBACK_DAYS=3650 npm run import-otbeat
 */

import {
  findHtmlPart,
  gmailAccessToken,
  gmailGet,
  listMessageIds,
  resolveLookbackDays,
} from './lib/gmail.mjs'
import { parseOtbeatHtml } from './lib/otbeat-parser.mjs'
import {
  createServiceRoleClient,
  findUntypedOtfSessions,
  loadEnv,
  upsertOtfSessions,
} from './lib/otbeat-supabase.mjs'

const OTBEAT_SENDER = 'OTbeatReport@orangetheoryfitness.com'
const DEFAULT_LOOKBACK_DAYS = 8

async function main() {
  loadEnv()
  const lookbackDays = resolveLookbackDays('OTBEAT_LOOKBACK_DAYS', DEFAULT_LOOKBACK_DAYS)

  const token = await gmailAccessToken()
  const ids = await listMessageIds(token, `from:${OTBEAT_SENDER} newer_than:${lookbackDays}d`)
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
      `(already present), repaired ${summary.repaired} null class_type, ` +
      `${summary.total} total in otf_sessions.`
  )
  console.log(JSON.stringify(summary))

  // Data-quality gate: every counted session must carry a class_type, or it
  // matches no filter chip and reads as a missing workout. The in-window
  // backfill above fixes what this pull can see; anything left is an older
  // orphan outside the lookback that needs a repair migration, so fail loudly
  // rather than let it sit unnoticed (it took 20 days last time).
  const untyped = await findUntypedOtfSessions(supabase)
  if (untyped.length > 0) {
    console.error(
      `\n✗ ${untyped.length} counted session(s) have no class_type — they are ` +
        `only reachable via the "Unclassified" filter and skew nothing but look missing:`
    )
    for (const s of untyped) {
      console.error(`    ${s.started_at}  ${s.coach ?? '(no coach)'}  ${s.calories ?? '?'} cal`)
    }
    console.error(
      `\n  These predate this pull's lookback window. Widen it with ` +
        `OTBEAT_LOOKBACK_DAYS to let the backfill reach them, or add a repair ` +
        `migration modelled on 20260724120000_otf_sessions_class_type_repair.sql.`
    )
    // exitCode rather than process.exit(1): the diagnostic above is the whole
    // point of failing, and an immediate exit can truncate buffered stderr when
    // it's piped (CI log capture). Setting the code lets main() return and the
    // stream drain on its own.
    process.exitCode = 1
  }
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
