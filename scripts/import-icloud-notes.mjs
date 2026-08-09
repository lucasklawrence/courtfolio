#!/usr/bin/env node
/**
 * `npm run import-icloud-notes` — historical Apple Notes workouts → Supabase (#400).
 *
 * Two years of training (2022-2024) were logged one note per session, titled
 * with the template that was run and holding a `Set | Weight | Reps` table per
 * exercise. Apple's bulk export flattens notes to plain text, and plain text
 * cannot hold a table — every one collapses to a `￼` placeholder and the
 * numbers go with it. So the tables are transcribed from the rendered note into
 * JSON under `.notes-extract/` (gitignored, personal training data), and this
 * script is the half that turns that JSON into rows.
 *
 * What it does, in order:
 *
 * 1. Reads every `.json` in the extract directory.
 * 2. Reads Apple's `Notes Details.csv` manifest for each note's created and
 *    last-modified stamps — the window the note was written across.
 * 3. Attributes each note to an existing `apple_health` session (#413) whose
 *    window it overlaps. These notes were typed *during* the workout, so the
 *    overlap is usually total: on 2024-04-16 the Health window was
 *    21:39:00-22:10:42 and the note spanned 21:40:38-22:07:12. A note that
 *    matches nothing becomes its own `icloud_notes` session rather than being
 *    dropped.
 * 4. Parses each note into sets, keeping the session's own table work apart
 *    from grease-the-groove rep lists, which are that day's volume and not part
 *    of the workout they sit inside.
 * 5. Upserts, keyed on a deterministic `import_key`, so a re-run converges
 *    instead of doubling two years of history.
 *
 * Nothing here deletes. An imported session may already carry Health-derived
 * duration and heart rate, and a set logged through the app is not ours to
 * touch.
 *
 * Run `--dry-run` first: it does every read, match and parse, prints the same
 * report, and writes nothing.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { createServiceRoleClient, loadEnv } from './lib/cardio-supabase.mjs'
import { matchNoteToSession, parseNotesCsvStamp } from './lib/icloud-notes-match.mjs'
import { parseNote, parseNoteDate } from './lib/icloud-notes-parser.mjs'
import {
  fetchExerciseSlugs,
  fetchLoadMultipliers,
  fetchSessionsInRange,
  upsertNoteSession,
  upsertNoteSets,
} from './lib/icloud-notes-supabase.mjs'

/** Where the transcribed notes live. Gitignored — see `.gitignore`. */
const DEFAULT_EXTRACT_DIR = '.notes-extract'

/** The zone the note stamps and the training itself are expressed in. */
const DEFAULT_TIME_ZONE = 'America/Los_Angeles'

/**
 * Read `--flag=value` style arguments.
 *
 * @param {string[]} argv Raw `process.argv.slice(2)`.
 * @returns {{extractDir: string, manifest: string|null, timeZone: string, dryRun: boolean}}
 */
function parseArgs(argv) {
  const get = name =>
    argv
      .find(arg => arg.startsWith(`--${name}=`))
      ?.split('=')
      .slice(1)
      .join('=')
  return {
    extractDir: get('extract-dir') ?? DEFAULT_EXTRACT_DIR,
    manifest: get('manifest') ?? null,
    timeZone: get('tz') ?? DEFAULT_TIME_ZONE,
    dryRun: argv.includes('--dry-run'),
  }
}

/**
 * Load every transcribed note from the extract directory.
 *
 * @param {string} dir Directory holding the per-batch JSON files.
 * @returns {Promise<Array<object>>} Notes across all batches, in file order.
 * @throws when the directory is missing or a file is not valid JSON.
 */
async function loadNotes(dir) {
  let entries
  try {
    entries = await readdir(dir)
  } catch {
    throw new Error(
      `No extract directory at "${dir}". Transcribe the notes first, or pass --extract-dir=<path>.`
    )
  }

  const notes = []
  for (const entry of entries.filter(name => name.endsWith('.json')).sort()) {
    const full = path.join(dir, entry)
    let parsed
    try {
      parsed = JSON.parse(await readFile(full, 'utf8'))
    } catch (error) {
      throw new Error(`Could not parse ${full}: ${error.message}`)
    }
    for (const note of parsed.notes ?? []) {
      notes.push({ ...note, _batch: entry })
    }
  }
  return notes
}

/**
 * Split one CSV line, honouring quoted fields.
 *
 * Apple's manifest is not quoted consistently and a note titled with a comma
 * spills into extra columns. Rather than guess where the title ended, rows
 * whose shape is wrong are skipped by the caller and reported — a note with no
 * timestamps still imports, it just falls back to a synthesized window.
 *
 * @param {string} line One raw CSV line.
 * @returns {string[]} Trimmed fields.
 */
function splitCsvLine(line) {
  const fields = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())
  return fields
}

/**
 * Index Apple's note manifest by title and local day.
 *
 * `(title, day)` rather than title alone because the log reuses six titles
 * across roughly 130 sessions — "Back Day 1" names 23 different workouts. The
 * day disambiguates them, and is the one thing both the manifest and the
 * rendered list agree on.
 *
 * @param {string} csv Raw contents of `Notes Details.csv`.
 * @param {string} timeZone Zone the stamps are expressed in.
 * @returns {Map<string, {created: Date, modified: Date}>} Keyed `title|YYYY-MM-DD`.
 */
export function indexManifest(csv, timeZone) {
  const index = new Map()
  const lines = csv.split(/\r?\n/).slice(1)

  for (const line of lines) {
    if (!line.trim()) continue
    const fields = splitCsvLine(line)
    if (fields.length < 3) continue

    // Created and modified are the two stamps; a title containing commas
    // pushes them right, so locate them from the end of the row instead of by
    // fixed position. The last four columns are the three Yes/No flags plus a
    // content hash, so the stamps sit just before those.
    const stampIndexes = fields
      .map((value, i) => ({ value, i }))
      .filter(({ value }) => /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(value))
      .map(({ i }) => i)
    if (stampIndexes.length < 2) continue

    const created = parseNotesCsvStamp(fields[stampIndexes[0]], timeZone)
    const modified = parseNotesCsvStamp(fields[stampIndexes[1]], timeZone)
    if (!created || !modified) continue

    // Everything before the first stamp is the title, commas and all.
    const title = fields.slice(0, stampIndexes[0]).join(', ')
    const day = localDay(created, timeZone)
    index.set(`${title}|${day}`, { created, modified })
  }

  return index
}

/**
 * The `YYYY-MM-DD` a moment falls on in a zone.
 *
 * @param {Date} instant The moment.
 * @param {string} timeZone IANA zone.
 * @returns {string} Day key.
 */
function localDay(instant, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/**
 * A stand-in window for a note whose manifest row could not be found.
 *
 * Midday local, half an hour long. Deliberately not midnight: a midnight stamp
 * read in the wrong zone slides onto the previous day, and the whole point of
 * the window is to land the session on the right one.
 *
 * @param {string} day `YYYY-MM-DD`.
 * @param {string} timeZone IANA zone.
 * @returns {{start: Date, end: Date}} The synthesized window.
 */
function fallbackWindow(day, timeZone) {
  const [year, month, date] = day.split('-').map(Number)
  const start = parseNotesCsvStamp(
    `${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}-${year} 12:00:00`,
    timeZone
  )
  return { start, end: new Date(start.getTime() + 30 * 60_000) }
}

async function main() {
  const { extractDir, manifest, timeZone, dryRun } = parseArgs(process.argv.slice(2))

  loadEnv()
  const supabase = createServiceRoleClient()

  const notes = await loadNotes(extractDir)
  if (notes.length === 0) {
    console.error(`No notes found in "${extractDir}". Nothing to import.`)
    process.exit(1)
  }

  const manifestIndex = manifest
    ? indexManifest(await readFile(manifest, 'utf8'), timeZone)
    : new Map()
  if (!manifest) {
    console.warn(
      'No --manifest given: every session falls back to a synthesized midday window, ' +
        'which will match far fewer Health sessions. Pass the export\'s "Notes Details.csv".'
    )
  }

  const [multipliers, catalogSlugs] = await Promise.all([
    fetchLoadMultipliers(supabase),
    fetchExerciseSlugs(supabase),
  ])

  // Resolve each note's day first so the session read can be scoped to the
  // range the notes actually cover.
  const dated = []
  const undatable = []
  for (const note of notes) {
    const day = parseNoteDate(note.date)
    if (!day) {
      undatable.push(note)
      continue
    }
    dated.push({ ...note, day })
  }
  dated.sort((a, b) => a.day.localeCompare(b.day))

  const first = fallbackWindow(dated[0].day, timeZone).start
  const last = fallbackWindow(dated[dated.length - 1].day, timeZone).end
  const sessions = await fetchSessionsInRange(
    supabase,
    new Date(first.getTime() - 36 * 3600_000).toISOString(),
    new Date(last.getTime() + 36 * 3600_000).toISOString()
  )

  const rows = []
  const unmappedMovements = new Map()
  const unknownSlugs = new Map()
  const report = { overlap: 0, sameDay: 0, ownSession: 0, missingManifest: 0 }
  const createdSessions = []

  for (const note of dated) {
    const entry = manifestIndex.get(`${note.title}|${note.day}`)
    if (!entry) report.missingManifest += 1
    const window = entry
      ? { start: entry.created, end: entry.modified }
      : fallbackWindow(note.day, timeZone)

    const match = matchNoteToSession(window, sessions, timeZone)
    const workoutId = match?.id ?? null

    if (match?.method === 'overlap') report.overlap += 1
    else if (match?.method === 'same-day') report.sameDay += 1
    else {
      report.ownSession += 1
      createdSessions.push({
        startedAt: window.start.toISOString(),
        endedAt: window.end.toISOString(),
        title: note.title,
        day: note.day,
      })
    }

    const { sets, unmapped } = parseNote({ ...note, date: note.day }, multipliers)
    for (const name of unmapped) {
      unmappedMovements.set(name, (unmappedMovements.get(name) ?? 0) + 1)
    }

    for (const set of sets) {
      if (!catalogSlugs.has(set.exercise)) {
        unknownSlugs.set(set.exercise, (unknownSlugs.get(set.exercise) ?? 0) + 1)
        continue
      }
      rows.push({
        pendingSessionFor: set.disposition === 'workout' && !workoutId ? note.day : null,
        row: {
          logged_at: window.start.toISOString(),
          exercise: set.exercise,
          reps: set.reps,
          weight_lbs: set.weight_lbs,
          // Grease-the-groove volume is that day's, not the session's — see
          // #400. Leaving `workout_id` null is what keeps it off the workout.
          workout_id: set.disposition === 'workout' ? workoutId : null,
          position: set.position,
          import_key: set.import_key,
        },
      })
    }
  }

  const workoutSets = rows.filter(r => r.row.workout_id !== null || r.pendingSessionFor).length
  const gtgSets = rows.length - workoutSets

  console.log('')
  console.log(`Notes read              ${notes.length}`)
  console.log(`  dated                 ${dated.length}`)
  console.log(`  undatable (skipped)   ${undatable.length}`)
  console.log(`Attribution`)
  console.log(`  matched by overlap    ${report.overlap}`)
  console.log(`  matched by same day   ${report.sameDay}`)
  console.log(`  own icloud session    ${report.ownSession}`)
  console.log(`  no manifest row       ${report.missingManifest}`)
  console.log(`Sets parsed             ${rows.length}`)
  console.log(`  workout               ${workoutSets}`)
  console.log(`  grease-the-groove     ${gtgSets}`)

  if (unmappedMovements.size > 0) {
    console.log('')
    console.log('Movements with no catalog match (add a real row, not a near-duplicate slug):')
    for (const [name, count] of [...unmappedMovements].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(4)}x  ${name}`)
    }
  }
  if (unknownSlugs.size > 0) {
    console.log('')
    console.log('Resolved to slugs absent from the catalog — these sets were dropped:')
    for (const [slug, count] of unknownSlugs) console.log(`  ${count}x  ${slug}`)
  }

  if (dryRun) {
    console.log('')
    console.log('--dry-run: nothing written.')
    return
  }

  // Sessions first: a note that matched nothing needs its own row before its
  // sets can point at one.
  const sessionIdByDay = new Map()
  for (const session of createdSessions) {
    const id = await upsertNoteSession(supabase, session)
    sessionIdByDay.set(session.day, id)
  }

  const prepared = rows.map(({ pendingSessionFor, row }) =>
    pendingSessionFor ? { ...row, workout_id: sessionIdByDay.get(pendingSessionFor) ?? null } : row
  )

  const { upserted } = await upsertNoteSets(supabase, prepared)
  console.log('')
  console.log(`Wrote ${createdSessions.length} sessions and ${upserted} sets.`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
