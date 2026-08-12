/**
 * Import OTF class bookings from a calendar and resolve session class formats
 * (#453, Phase A).
 *
 * Usage:
 *   node scripts/import-otf-bookings.mjs <path-to.ics>
 *   OTF_ICS_PATH=<path-to.ics> npm run import-otf-bookings
 *
 * Requires (see scripts\README.md):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * WHAT THIS IS FOR: `otf_sessions.class_type` is inferred from the OTbeat
 * email's machine signature and cannot tell 2G from 3G — the email carries no
 * class-template token at all. The template exists only in the booking
 * calendar. This reads those bookings and matches them to sessions.
 *
 * PHASE A SCOPE: the calendar source is a local `.ics` file, so this runs by
 * hand off an export. Phase B swaps in a CalDAV source against
 * `caldav.icloud.com` behind the same {@link
 * import('./lib/otf-calendar.mjs').CalendarSource} interface and moves these
 * two steps into `.github/workflows/otbeat-ingest.yml`, which already runs
 * daily under a concurrency group.
 *
 * WHY NO FEED-SILENCE GATE HERE: `findBookingFeedSilence` is built and tested
 * but deliberately unwired. Its trigger is "sessions ingested but zero bookings
 * in the window" — until the automated calendar pull exists that is true every
 * single day, so wiring it now would hold the job permanently red and train
 * everyone to ignore it. Phase B turns it on with the producer that makes it
 * meaningful.
 */

import {
  createServiceRoleClient,
  findSessionsMissingClassFormat,
  loadEnv,
  reconcileOtfBookings,
  upsertOtfBookings,
} from './lib/otf-booking-supabase.mjs'
import { createIcsFileSource } from './lib/otf-calendar.mjs'

/** Read the `.ics` path from argv or the environment, or explain what's missing. */
function resolveIcsPath() {
  const fromArgv = process.argv[2]?.trim()
  const fromEnv = process.env.OTF_ICS_PATH?.trim()
  const path = fromArgv || fromEnv
  if (!path) {
    throw new Error(
      'No calendar file given. Pass a path:\n' +
        '  node scripts/import-otf-bookings.mjs <path-to.ics>\n' +
        'or set OTF_ICS_PATH. Export the iCloud "Home" calendar to .ics until ' +
        'the CalDAV source lands (Phase B of #453).'
    )
  }
  return path
}

async function main() {
  loadEnv()
  const icsPath = resolveIcsPath()
  const supabase = createServiceRoleClient()

  const source = createIcsFileSource(icsPath)
  const { events, skipped } = await source.read()
  console.log(`Read ${events.length} event(s) from ${source.describe}.`)

  // Structurally unusable events (no UID, no DTSTART) can't be stored or
  // matched. Name them rather than letting the count quietly disagree.
  for (const s of skipped) {
    console.warn(`  ! skipped event (${s.reason}): ${s.titleRaw ?? '(no title)'}`)
  }

  const { written, notOtf, unparsedTitles } = await upsertOtfBookings(supabase, events)
  console.log(`Upserted ${written} booking(s); ignored ${notOtf} non-OTF calendar event(s).`)

  // A stored booking whose title didn't match the grammar keeps `title_raw` and
  // leaves the parsed columns null — never dropped, never guessed. Worth seeing,
  // because a run where these suddenly appear means OTF changed its title format.
  for (const title of unparsedTitles) {
    console.warn(`  ! unparsed booking title (stored raw, format null): ${title}`)
  }

  const summary = await reconcileOtfBookings(supabase)
  console.log(
    `Reconciled: linked ${summary.linked} session(s) to a booking, ` +
      `resolved ${summary.formatted} class format(s), ` +
      `${summary.unmatched} still unmatched, ${summary.manual} left to manual labels.`
  )
  console.log(JSON.stringify(summary))

  // Report-only, never a failure. ~9% of sessions are legitimate drop-ins booked
  // outside the app flow, and #453 leaves those null rather than guessing once
  // recall has faded. Exiting non-zero here would keep the job permanently red.
  const missing = await findSessionsMissingClassFormat(supabase)
  if (missing.length > 0) {
    console.log(`\n${missing.length} counted session(s) still have no class_format:`)
    for (const s of missing) {
      console.log(`    ${s.started_at}  ${s.studio ?? '(no studio)'}`)
    }
    console.log(
      '\n  Expected for drop-ins with no calendar booking. Label one by setting ' +
        "class_format and class_format_source='manual' in Supabase; leave it null " +
        'rather than guessing if you no longer remember the template.'
    )
  }
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
