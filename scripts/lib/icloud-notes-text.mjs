/**
 * Parser for the Shortcuts export of historical workout notes (#400).
 *
 * Apple's bulk Data & Privacy export flattens notes to plain text and drops
 * every table on the way, so the weights and reps only survive in the rendered
 * note. A Shortcut reading `Note Body` on-device *does* keep them — but as one
 * cell per line, with an empty line for an empty cell:
 *
 *     Squats 5 sets
 *     Set
 *     Weight
 *     Reps
 *     1
 *     95
 *     10
 *     2
 *     115
 *
 * The last row there is set 2 at 115 for *no recorded reps*, not a set of 115
 * reps. That is the whole difficulty of this format: blank lines are data, so
 * nothing here may discard them, and a row is exactly three lines whatever they
 * contain.
 *
 * Pure text→structure. Movement mapping, load conversion and the
 * grease-the-groove split all live in `icloud-notes-parser.mjs`, which consumes
 * what this produces.
 */

/**
 * Note boundary in the Shortcuts output, e.g. `===  Back Day 1| 2024-04-16=== `.
 *
 * Matched globally rather than per line because the separator does not reliably
 * start one: a note whose body ends without a trailing newline runs straight
 * into the next header (`Workout pace: 35 min ===  Chest Day 2| 2024-03-18===`).
 */
const NOTE_SEPARATOR = /===\s*([^|]+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*===/g

/** A table's `Set` column header. Sometimes pluralized, sometimes annotated. */
const SET_HEADER = /^sets?\b/i

/** A table's `Weight` column header — `Weight`, `Weight (total)`, `Weight `. */
const WEIGHT_HEADER = /^weight\b/i

/**
 * A table's third column header.
 *
 * Not always reps: walking lunges count `Steps`, planks record
 * `Time (seconds)`. Captured verbatim so the consumer can decide what the
 * number means rather than assuming.
 */
const MEASURE_HEADER = /^(reps?|steps|time\b)/i

/** `180 - 15` — the older freeform "weight - reps" shorthand. */
const PAIR_LINE = /^\s*([\d.]+)\s*-\s*(\d+)\s*$/

/** A bare rep count on its own line. */
const BARE_INT = /^\s*(\d{1,3})\s*$/

/**
 * A `Set 1` / `Set 2:` line from a non-tabular block.
 *
 * Sled pushes and rack runs were written as loose `Set N` labels with the load
 * underneath rather than as tables. Those labels are not movements, and reading
 * them as such invents an exercise called "Set 1" performed for 55 reps.
 */
const SET_LABEL = /^set\s*\d+\s*:?\s*$/i

/**
 * A line that states a load rather than naming a movement.
 *
 * The older notes put the weight on its own line under the movement and the
 * reps beneath it:
 *
 *     Shrugs
 *     35 DB
 *     20
 *     20
 *
 * Read naively that is a movement called "35 DB". It is really two sets of
 * shrugs at 35 lb per hand, and treating the line as a heading loses both the
 * load and the movement.
 */
const LOAD_LINE =
  /^(bw(\s*[+-]\s*\d+(\.\d+)?)?|\d+(\.\d+)?\s*(db|lbs?|kg|medicine ball)?|light)\s*$/i

/** Plausible set numbers. Tables in this log run to 18 rows at most. */
const MAX_SET_ROWS = 40

/**
 * A block written as `Set N:` labels rather than a table (#435).
 *
 * Two movements in this log are recorded this way, both because a plain
 * `Set | Weight | Reps` grid cannot express them:
 *
 *     Rack Run 35,30,25,20 2 sets     21s 2 sets
 *     Set 1: 25, 20, 10               Set 1: 22.5 DB
 *     Set 2:                          Set 2:  22.5 DB
 *
 * The heading names the movement and declares how many sets; each `Set N:` line
 * carries what that set was, which for a rack run is the loads it ran down and
 * for 21s is the single load it used. Reps appear in neither, and for a rack run
 * they never existed — each drop went to failure.
 */
const LABELLED_BLOCK = /^(rack run|21s)\b(.*)$/i

/** One `Set N:` line and whatever followed the colon. */
const SET_LINE = /^set\s*(\d+)\s*:?\s*(.*)$/i

/**
 * Split the Shortcuts output into individual notes.
 *
 * @param {string} text Whole exported file.
 * @returns {Array<{title: string, date: string, body: string}>} Notes in file
 *   order. Text before the first separator is dropped — it is the file's
 *   preamble, not a note.
 */
export function splitNotes(text) {
  if (typeof text !== 'string') return []
  const parts = text.split(NOTE_SEPARATOR)
  const notes = []
  // parts[0] is the preamble; then repeating [title, date, body].
  for (let i = 1; i + 2 < parts.length + 1; i += 3) {
    const title = parts[i]
    const date = parts[i + 1]
    const body = parts[i + 2]
    if (title === undefined || date === undefined) break
    notes.push({ title: title.trim(), date, body: body ?? '' })
  }
  return notes
}

/**
 * Whether three consecutive lines are a table's column headers.
 *
 * @param {string[]} lines All lines of the note.
 * @param {number} i Index of the candidate `Set` line.
 * @returns {boolean} True when lines `i..i+2` head a table.
 */
function isHeaderAt(lines, i) {
  return (
    SET_HEADER.test((lines[i] ?? '').trim()) &&
    WEIGHT_HEADER.test((lines[i + 1] ?? '').trim()) &&
    MEASURE_HEADER.test((lines[i + 2] ?? '').trim())
  )
}

/**
 * Find the movement name a table belongs to.
 *
 * Scans backwards from the header for the nearest line that names a movement,
 * preferring one that declares a set count (`Squats 5 sets`). A table is often
 * preceded by a bare qualifier — `Machine`, `Barbell`, `Did cable curl` — which
 * describes the movement without being its name, so those are stepped over.
 *
 * @param {string[]} lines All lines of the note.
 * @param {number} headerIndex Index of the header's `Set` line.
 * @returns {{name: string, declared: string|null, note: string|null}} The
 *   heading, its declared set count if it stated one, and any qualifier line
 *   found between the heading and the table.
 */
function headingFor(lines, headerIndex) {
  const candidates = []
  for (let i = headerIndex - 1; i >= 0 && candidates.length < 4; i -= 1) {
    const line = (lines[i] ?? '').trim()
    if (line === '') continue
    candidates.push(line)
    if (/\d+\s*(-\s*\d+)?\s*sets?\b/i.test(line)) break
  }
  if (candidates.length === 0) return { name: '', declared: null, note: null }

  // Nearest-last: candidates[0] is closest to the table.
  const declaredIndex = candidates.findIndex(line => /\d+\s*(-\s*\d+)?\s*sets?\b/i.test(line))
  const headingLine = declaredIndex >= 0 ? candidates[declaredIndex] : candidates[0]
  const qualifier = declaredIndex > 0 ? candidates[0] : null

  const declared = headingLine.match(/(\d+\s*(?:-\s*\d+)?\s*sets?)/i)?.[1] ?? null
  const name = headingLine.replace(/\d+\s*(?:-\s*\d+)?\s*sets?\b/i, '').trim()

  return { name, declared, note: qualifier }
}

/**
 * Read a table's rows, starting just past its headers.
 *
 * Rows are strictly three lines each — set, weight, measure — because an empty
 * cell is an empty line. Reading stops at the first triple whose leading cell
 * is not a plausible set number, which is what separates the table from the
 * blank line or next heading that follows it.
 *
 * @param {string[]} lines All lines of the note.
 * @param {number} start Index of the first row's set-number line.
 * @returns {{rows: Array<{set: number, weight: string, reps: string}>, next: number}}
 *   The rows, and the index to resume scanning from.
 */
function readRows(lines, start) {
  let i = start
  // Blank lines between the header and the first row are layout, not a cell.
  while (i < lines.length && (lines[i] ?? '').trim() === '') i += 1

  const rows = []
  while (i + 2 < lines.length + 2 && rows.length < MAX_SET_ROWS) {
    const setCell = (lines[i] ?? '').trim()
    const setNumber = Number(setCell.match(/^(\d{1,2})/)?.[1])
    if (!Number.isFinite(setNumber) || setNumber < 1 || setNumber > MAX_SET_ROWS) break

    rows.push({
      set: setNumber,
      weight: (lines[i + 1] ?? '').trim(),
      reps: (lines[i + 2] ?? '').trim(),
    })
    i += 3
  }
  return { rows, next: i }
}

/**
 * Parse one note body into tables, rep lists and leftover text.
 *
 * @param {string} body The note's text, separator stripped.
 * @returns {{exercises: Array<{name: string, declared: string|null,
 *   weight_header: string, measure_header: string, note: string|null,
 *   sets: Array<{set: number, weight: string, reps: string}>}>,
 *   rep_lists: Array<{movement: string, reps: number[]}>, loose_text: string[],
 *   labelled_blocks: Array<{movement: string, declared: string|null,
 *     planned: string, sets: Array<{set: number, value: string}>}>}}
 *   `labelled_blocks` holds the `Set N:` shapes — rack runs and 21s — whose
 *   values are loads rather than reps; see {@link LABELLED_BLOCK}.
 */
export function parseNoteBody(body) {
  const lines = String(body ?? '').split(/\r?\n/)
  const exercises = []
  const repLists = []
  const looseText = []
  const labelledBlocks = []

  /** Lines already consumed by a table, so the rep-list pass skips them. */
  const consumed = new Set()

  for (let i = 0; i < lines.length; i += 1) {
    if (!isHeaderAt(lines, i)) continue
    const { name, declared, note } = headingFor(lines, i)
    const { rows, next } = readRows(lines, i + 3)
    for (let j = i; j < next; j += 1) consumed.add(j)

    exercises.push({
      name,
      declared,
      weight_header: (lines[i + 1] ?? '').trim(),
      measure_header: (lines[i + 2] ?? '').trim(),
      note,
      sets: rows,
    })
    i = next - 1
  }

  // Second pass: `Set N:` blocks, which are not tables and would otherwise fall
  // through to the loose-text pile — see LABELLED_BLOCK.
  for (let i = 0; i < lines.length; i += 1) {
    if (consumed.has(i)) continue
    const block = (lines[i] ?? '').trim().match(LABELLED_BLOCK)
    if (!block) continue

    const [, movement, rest] = block
    const declared = rest.match(/(\d+\s*sets?)/i)?.[1] ?? null
    // Everything before the set count is the planned rack (`35,30,25,20`) —
    // what was *intended*, which the body below routinely disagrees with.
    const planned = rest
      .replace(/\d+\s*sets?\b/i, '')
      .trim()
      .replace(/^[,\s]+|[,\s]+$/g, '')

    const setLines = []
    let j = i + 1
    // Scan to the next movement, tolerating the blank lines between labels.
    while (j < lines.length) {
      const line = (lines[j] ?? '').trim()
      if (line === '') {
        j += 1
        continue
      }
      const setLine = line.match(SET_LINE)
      if (!setLine) break
      // A label's value sits either after the colon or on the following line.
      let value = setLine[2].trim()
      let consumedThrough = j
      if (value === '') {
        let k = j + 1
        while (k < lines.length && (lines[k] ?? '').trim() === '') k += 1
        const following = (lines[k] ?? '').trim()
        if (following !== '' && !SET_LINE.test(following) && /[\d.]/.test(following)) {
          value = following
          consumedThrough = k
        }
      }
      setLines.push({ set: Number(setLine[1]), value })
      j = consumedThrough + 1
    }

    if (setLines.length === 0) continue
    for (let k = i; k < j; k += 1) consumed.add(k)

    labelledBlocks.push({ movement: movement.trim(), declared, planned, sets: setLines })
    i = j - 1
  }

  // Third pass: headings followed by bare numbers (grease-the-groove volume)
  // or `weight - reps` pairs (the older freeform shorthand).
  //
  // `lastHeading` carries the most recent line that actually named a movement,
  // so a bare load line underneath it can be attributed to the right exercise
  // rather than becoming one.
  let lastHeading = null

  for (let i = 0; i < lines.length; i += 1) {
    if (consumed.has(i)) continue
    const heading = (lines[i] ?? '').trim()
    if (heading === '' || BARE_INT.test(heading) || PAIR_LINE.test(heading)) continue
    if (isHeaderAt(lines, i)) continue
    // A loose `Set 1` label belongs to the block above it, not to a movement.
    if (SET_LABEL.test(heading)) continue

    const isLoadLine = LOAD_LINE.test(heading)
    if (!isLoadLine) lastHeading = heading

    const reps = []
    const pairs = []
    let j = i + 1
    // Tolerate one blank line between the heading and its numbers.
    while (j < lines.length && (lines[j] ?? '').trim() === '') j += 1
    const firstValue = j

    while (j < lines.length && !consumed.has(j)) {
      const line = (lines[j] ?? '').trim()
      if (line === '') break
      const pair = line.match(PAIR_LINE)
      if (pair) {
        pairs.push({ weight: pair[1], reps: Number(pair[2]) })
        j += 1
        continue
      }
      const bare = line.match(BARE_INT)
      if (bare) {
        reps.push(Number(bare[1]))
        j += 1
        continue
      }
      break
    }

    if (j === firstValue) {
      // No numbers followed — it is prose, and worth keeping verbatim.
      if (!/^(set|weight|reps?|steps|sets)\b/i.test(heading)) looseText.push(heading)
      continue
    }

    if (pairs.length > 0) {
      exercises.push({
        name: heading,
        declared: null,
        weight_header: 'Weight',
        measure_header: 'Reps',
        note: 'freeform weight - reps',
        sets: pairs.map((pair, index) => ({
          set: index + 1,
          weight: pair.weight,
          reps: String(pair.reps),
        })),
      })
    } else if (reps.length > 0 && isLoadLine && lastHeading !== null) {
      // `Shrugs / 35 DB / 20 / 20` — the load applies to every rep beneath it.
      exercises.push({
        name: lastHeading,
        declared: null,
        weight_header: 'Weight',
        measure_header: 'Reps',
        note: 'load stated above the reps',
        sets: reps.map((count, index) => ({
          set: index + 1,
          weight: heading,
          reps: String(count),
        })),
      })
    } else if (reps.length > 0 && !isLoadLine) {
      repLists.push({ movement: heading, reps })
    }
    for (let k = i; k < j; k += 1) consumed.add(k)
    i = j - 1
  }

  return {
    exercises,
    rep_lists: repLists,
    loose_text: looseText,
    labelled_blocks: labelledBlocks,
  }
}

/**
 * Parse a whole Shortcuts export.
 *
 * @param {string} text The exported file.
 * @returns {Array<{title: string, date: string,
 *   exercises: Array<{name: string, declared: string|null, weight_header: string,
 *     measure_header: string, note: string|null,
 *     sets: Array<{set: number, weight: string, reps: string}>}>,
 *   rep_lists: Array<{movement: string, reps: number[]}>, loose_text: string[]}>}
 *   One entry per note, shaped for `icloud-notes-parser.mjs`'s `parseNote`.
 */
export function parseExport(text) {
  return splitNotes(text).map(note => ({
    title: note.title,
    date: note.date,
    ...parseNoteBody(note.body),
  }))
}
