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
import { matchNoteToSession, noteWindow, parseNotesCsvStamp } from './lib/icloud-notes-match.mjs'
import {
  isSessionNote,
  parseNote,
  parseNoteDate,
  templateNameForNote,
} from './lib/icloud-notes-parser.mjs'
import { parseExport } from './lib/icloud-notes-text.mjs'
import {
  fetchExerciseSlugs,
  fetchLoadMultipliers,
  fetchSessionsInRange,
  fetchTemplateIdsByName,
  linkSessionTemplates,
  pruneNoteImports,
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
    fromText: get('from-text') ?? null,
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
  const { extractDir, fromText, manifest, timeZone, dryRun } = parseArgs(process.argv.slice(2))

  loadEnv()
  const supabase = createServiceRoleClient()

  // Two front ends onto the same pipeline: `--from-text` reads the Shortcuts
  // export directly (one cell per line, blank lines meaning empty cells), while
  // the extract directory holds notes already transcribed to JSON.
  const notes = fromText
    ? parseExport(await readFile(fromText, 'utf8'))
    : await loadNotes(extractDir)
  if (notes.length === 0) {
    console.error(`No notes found in "${fromText ?? extractDir}". Nothing to import.`)
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

  const [multipliers, catalogSlugs, templateIdByName] = await Promise.all([
    fetchLoadMultipliers(supabase),
    fetchExerciseSlugs(supabase),
    fetchTemplateIdsByName(supabase),
  ])

  // Resolve each note's day first so the session read can be scoped to the
  // range the notes actually cover.
  const dated = []
  const undatable = []
  const skipped = []
  for (const note of notes) {
    // A programme document is not a session — see NON_SESSION_NOTES.
    if (!isSessionNote(note.title)) {
      skipped.push(note.title)
      continue
    }
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
  const templateLinks = new Map()
  const unmappedMovements = new Map()
  const timedMovements = new Map()
  const unknownSlugs = new Map()
  const report = {
    overlap: 0,
    sameDay: 0,
    ownSession: 0,
    noSession: 0,
    missingManifest: 0,
    clampedWindow: 0,
  }
  const createdSessions = []

  for (const note of dated) {
    const entry = manifestIndex.get(`${note.title}|${note.day}`)
    if (!entry) report.missingManifest += 1
    const window = entry
      ? noteWindow(entry.created, entry.modified)
      : fallbackWindow(note.day, timeZone)
    if (window.clamped) report.clampedWindow += 1

    const match = matchNoteToSession(window, sessions, timeZone)
    const workoutId = match?.id ?? null

    // Identity for a note that needs its own session. Keyed by title *and*
    // start instant, not by day: two unmatched notes can fall on one local date
    // — which is precisely the situation that defeats overlap matching in the
    // first place — and a day-keyed map would hand the second note's id to the
    // first note's sets, silently merging two distinct workouts into one.
    const noteKey = `${note.title}|${window.start.toISOString()}`

    // Which of the six templates this note ran, where it ran one. Keyed by the
    // session it landed on — or by `noteKey` when the session doesn't exist yet
    // and gets created below.
    const templateName = templateNameForNote(note.title)
    const templateId = templateName ? (templateIdByName.get(templateName) ?? null) : null
    if (templateId !== null) templateLinks.set(workoutId ?? noteKey, templateId)

    const { sets, unmapped, timed } = parseNote({ ...note, date: note.day }, multipliers)

    // Parsed before the session decision, because whether a note deserves its
    // own session depends on whether it produced any. A note whose content is
    // all grease-the-groove rep lists — most `Pull ups` and `Squat` notes — has
    // no session work at all, and one that isn't about training (`Jared`, a
    // list of names; `Lucas - 0792`, a locker number) has nothing whatsoever.
    // Minting a session for those leaves the session log full of empty
    // workouts that were never performed.
    const hasWorkoutSets = sets.some(set => set.disposition === 'workout')

    if (match?.method === 'overlap') report.overlap += 1
    else if (match?.method === 'same-day') report.sameDay += 1
    else if (hasWorkoutSets) {
      report.ownSession += 1
      createdSessions.push({
        startedAt: window.start.toISOString(),
        endedAt: window.end.toISOString(),
        title: note.title,
        noteKey,
      })
    } else {
      report.noSession += 1
    }

    for (const name of unmapped) {
      unmappedMovements.set(name, (unmappedMovements.get(name) ?? 0) + 1)
    }
    for (const name of timed ?? []) {
      timedMovements.set(name, (timedMovements.get(name) ?? 0) + 1)
    }

    for (const set of sets) {
      if (!catalogSlugs.has(set.exercise)) {
        unknownSlugs.set(set.exercise, (unknownSlugs.get(set.exercise) ?? 0) + 1)
        continue
      }
      rows.push({
        pendingSessionFor: set.disposition === 'workout' && !workoutId ? noteKey : null,
        row: {
          logged_at: window.start.toISOString(),
          exercise: set.exercise,
          reps: set.reps,
          weight_lbs: set.weight_lbs,
          ...(set.variant === undefined ? {} : { variant: set.variant }),
          ...(set.duration_seconds === undefined ? {} : { duration_seconds: set.duration_seconds }),
          // Always sent, never conditionally spread: PostgREST builds one
          // INSERT from the union of keys across the batch, and a row missing
          // the key gets NULL rather than the column default — which a
          // `not null` column rejects, failing the whole batch.
          to_failure: set.to_failure === true,
          // Same reasoning as `to_failure`: always sent so a batch mixing
          // grouped and ungrouped sets doesn't leave the key out of the INSERT
          // for one of them. Null is the ordinary case — a set on its own.
          set_group: set.set_group ?? null,
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
  console.log(`  not a session         ${skipped.length}`)
  console.log(`Templates linked        ${templateLinks.size}`)
  console.log(`Attribution`)
  console.log(`  matched by overlap    ${report.overlap}`)
  console.log(`  matched by same day   ${report.sameDay}`)
  console.log(`  own icloud session    ${report.ownSession}`)
  console.log(`  loose volume only     ${report.noSession}`)
  console.log(`  no manifest row       ${report.missingManifest}`)
  console.log(`  late edit discarded   ${report.clampedWindow}`)
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
  if (timedMovements.size > 0) {
    console.log('')
    console.log('Duration-measured movements skipped (weight_room_sets has no duration column):')
    for (const [name, count] of timedMovements) console.log(`  ${count}x  ${name}`)
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

  // Anything previously imported from a note now classed as a programme
  // document has to be removed, not merely left out of this payload — see
  // pruneNoteImports.
  const pruned = await pruneNoteImports(supabase, skipped)
  if (pruned.sets > 0 || pruned.sessions > 0) {
    console.log('')
    console.log(`Pruned ${pruned.sets} sets and ${pruned.sessions} sessions from skipped notes.`)
  }

  // Sessions first: a note that matched nothing needs its own row before its
  // sets can point at one. Keyed per note rather than per day — see `noteKey`.
  const sessionIdByNote = new Map()
  for (const session of createdSessions) {
    const id = await upsertNoteSession(supabase, session)
    sessionIdByNote.set(session.noteKey, id)
  }

  const prepared = rows.map(({ pendingSessionFor, row }) =>
    pendingSessionFor ? { ...row, workout_id: sessionIdByNote.get(pendingSessionFor) ?? null } : row
  )

  const { upserted } = await upsertNoteSets(supabase, prepared)

  // Templates last: a note that needed its own session only has an id now.
  const resolvedLinks = new Map()
  for (const [key, templateId] of templateLinks) {
    const workoutId = sessionIdByNote.get(key) ?? key
    if (typeof workoutId === 'string' && workoutId.includes('|')) continue
    resolvedLinks.set(workoutId, templateId)
  }
  const { linked } = await linkSessionTemplates(supabase, resolvedLinks)

  console.log('')
  console.log(`Wrote ${createdSessions.length} sessions and ${upserted} sets.`)
  console.log(`Linked ${linked} sessions to their template.`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
