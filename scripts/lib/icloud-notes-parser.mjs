/**
 * Parser for historical workout notes transcribed from Apple Notes (#400).
 *
 * Two years of training (2022-2024) were logged one note per session, titled
 * with the template that was run and holding a `Set | Weight | Reps` table per
 * exercise. Apple's bulk Data & Privacy export flattens every note to plain
 * text, and plain text cannot represent a table — each one collapses to a
 * single `￼` placeholder, taking the numbers with it. The tables survive
 * only in the rendered note, so they were transcribed from iCloud web into the
 * JSON this module consumes.
 *
 * Everything here is pure. Extraction is upstream, Supabase is downstream, and
 * the interesting decisions — which movement a name means, whether a number is
 * per-hand or combined, whether a rep list is part of the workout at all — are
 * all testable without either.
 */

/**
 * Note movement names to `weight_room_exercises` slugs.
 *
 * Keys are normalized by {@link normalizeName}, so spacing, case, punctuation
 * and a trailing plural are already accounted for and do not need their own
 * entries. What does need an entry is anything where the note's wording and the
 * catalog's slug are genuinely different words ("Military press" /
 * `barbell-overhead-press`), because guessing across that gap is how volume
 * silently lands on the wrong movement.
 *
 * Several of these were resolved during #375's template transcription and are
 * reused rather than re-derived.
 */
const RAW_MOVEMENT_ALIASES = {
  // --- pulling ---
  'Pull ups': 'pullups',
  'Chin ups': 'chinups',
  'Seated two arm Row': 'seated-cable-row',
  'Seated Row': 'seated-cable-row',
  'One arm DB Row': 'dumbbell-row',
  'DB Row': 'dumbbell-row',
  'Barbell Bent Over Rows': 'barbell-row',
  'Bent Over Rows': 'barbell-row',
  'Lat Pulldowns': 'lat-pulldown',
  'Upright Rows': 'upright-row',
  'Back extension': 'back-extension',
  'Back ext': 'back-extension',
  'DB shrugs': 'shrugs',
  Shrugs: 'shrugs',

  // --- curls ---
  'EZ curl standing': 'ez-bar-curl',
  'EZ curl': 'ez-bar-curl',
  'Seated Alt Curls': 'dumbbell-curl',
  'Seated alt db curls': 'dumbbell-curl',
  'Alt db curls': 'dumbbell-curl',
  'Alt Curls': 'dumbbell-curl',
  'Preacher curls': 'preacher-curl',
  'Rope curls': 'rope-curl',

  // --- pressing ---
  'Barbell Bench Press': 'barbell-bench-press',
  'Bench Press': 'barbell-bench-press',
  'Incline barbell press': 'barbell-incline-press',
  'Decline Barbell Press': 'barbell-decline-press',
  'Military press': 'barbell-overhead-press',
  'DB Flat Press': 'dumbbell-bench-press',
  'Incline DB press': 'dumbbell-incline-press',
  'Seated DB press Alt': 'dumbbell-shoulder-press',
  'Seated DB press': 'dumbbell-shoulder-press',
  'Seated Alt Shoulder Press DB': 'dumbbell-shoulder-press',
  'Alt Shoulder Press DB': 'dumbbell-shoulder-press',
  'Close grip bench press': 'close-grip-bench-press',
  'Push ups': 'pushups',
  Dips: 'dips',
  'Bench dips': 'dips',

  // --- triceps ---
  'Skull Crushers': 'skull-crushers',
  'Tricep Pressdowns': 'cable-tricep-pushdown',
  'Rope Overhead Ext': 'rope-overhead-extension',
  'Rope Overhead Extension': 'rope-overhead-extension',

  // --- legs ---
  // NOT the bodyweight `squats` movement — see resolveTableMovement.
  Squats: 'barbell-back-squat',
  'Walking Lunges': 'walking-lunges',
  Lunges: 'lunges',
  'One Leg RDL': 'single-leg-romanian-deadlift',
  'RDL Barbell': 'barbell-romanian-deadlift',
  'Barbell RDL': 'barbell-romanian-deadlift',
  'Leg Press': 'leg-press',
  'Calf Leg Press': 'calf-press-machine',
  'Seated Calf Raises': 'seated-calf-raise',
  'Step Ups': 'step-ups',
  'Sled Push': 'sled-push',

  // --- core ---
  Planks: 'plank',
  'Knee Tucks': 'knee-tucks',
  'Hanging Knee tuck': 'knee-tucks',
  'Hanging leg raises': 'hanging-leg-raise',
  'Leg raises': 'hanging-leg-raise',
  'Heavy Russian Twists': 'russian-twist',
  'Russian Twists': 'russian-twist',
  'Decline Weighted Crunches': 'decline-crunch',
  'Decline crunches': 'decline-crunch',

  // --- wordings only the older notes use ---
  'Standing curls': 'dumbbell-curl',
  'Cable curl': 'rope-curl',
  'DB curls': 'dumbbell-curl',
  'DB curl': 'dumbbell-curl',
  'Dumbell shrug': 'shrugs',
  Deadlift: 'barbell-deadlift',
  'Side lateral raise': 'dumbbell-lateral-raise',
  'Front lateral raise': 'dumbbell-lateral-raise',
  'Lateral shoulder raise': 'dumbbell-lateral-raise',
  'Lateral DB raises': 'dumbbell-lateral-raise',
  'Lateral raises side': 'dumbbell-lateral-raise',
  'Lateral raises front': 'dumbbell-lateral-raise',
  'Rope tricep push down': 'cable-tricep-pushdown',
  'Rope tricep press down': 'cable-tricep-pushdown',
  'Tricep push down': 'cable-tricep-pushdown',
  'Tricep press down': 'cable-tricep-pushdown',
  'Seated Tricep push down': 'cable-tricep-pushdown',
  'Light sled push': 'sled-push',
  'Sled push': 'sled-push',
  'Seated Alt Shoulder DB': 'dumbbell-shoulder-press',
  'Seated Alt Shoulder Press DB': 'dumbbell-shoulder-press',
  'Standing shoulder DB press': 'dumbbell-shoulder-press',
  'Body weight squat': 'squats',
  'Balance board squat': 'squats',
  'Medicine ball squat': 'squats',
  'Back row machine': 'seated-cable-row',
  'Seated row': 'seated-cable-row',
  'Lat pull down': 'lat-pulldown',
  'Lat pull-down': 'lat-pulldown',
  'Pec fly machine': 'pec-deck',
  'Rear delt machine': 'cable-face-pull',
  'Preacher curl machine': 'preacher-curl',
  'Machine preacher curl': 'preacher-curl',
  'Seated calf raise machine': 'seated-calf-raise',
  'Standing calf raise': 'calf-raise',
  'Glute press': 'barbell-hip-thrust',
  'Glute leg press': 'leg-press',
  Bench: 'barbell-bench-press',
  'Incline barbell bench press': 'barbell-incline-press',
  // Typos preserved from the source rather than corrected there.
  'Incline barbell ress': 'barbell-incline-press',
  'Incline Barbell press': 'barbell-incline-press',
  'Ez curl': 'ez-bar-curl',
  'Ez curl standing': 'ez-bar-curl',
  'Walking lunges': 'walking-lunges',

  // Plyo box work. The height is the load and rides on the set's variant, so
  // every height resolves to one movement — see the #400 catalog migration.
  '18 inch plyo': 'box-jump',
  '24 inch plyo': 'box-jump',
  '30 inch plyo': 'box-jump',
  '12 inch plyo': 'box-jump',
  'One leg 12 inch plyo': 'box-jump',
  'One leg plyo 12 inch': 'box-jump',
  Plyo: 'box-jump',

  'Assisted pull ups': 'assisted-pullups',
  Assisted: 'assisted-pullups',

  // Typos preserved from the source.
  'Inclined DB press': 'dumbbell-incline-press',
  'Db lateral raise': 'dumbbell-lateral-raise',
  'Side lateral': 'dumbbell-lateral-raise',
  'Front layer raise': 'dumbbell-lateral-raise',
}

/**
 * Notes that describe training without being a record of a session (#436).
 *
 * `Strength Cycle` is the program itself — all six templates in one note, with
 * example numbers, a `Workout pace` line per template, and app feature notes at
 * the bottom. Imported as a session it became a single 30-minute workout of
 * 163 sets and 1,523 reps across 32 movements, which is not a thing that
 * happened: it distorted that day's totals, the all-time biggest session, and
 * every density figure at once.
 *
 * Its metadata says the same thing — created 2022-04-29 and last modified
 * 2025-03-09, a document revised for three years rather than a log written
 * during a workout. The sets in it are also not the author's.
 *
 * Matched on title, so both copies of the note are covered.
 */
export const NON_SESSION_NOTES = Object.freeze(new Set(['strength cycle']))

/**
 * Whether a note records a session at all.
 *
 * @param {string} title Note title.
 * @returns {boolean} False for reference documents — see {@link NON_SESSION_NOTES}.
 */
export function isSessionNote(title) {
  return !NON_SESSION_NOTES.has(
    String(title ?? '')
      .trim()
      .toLowerCase()
  )
}

/**
 * Note titles to the workout template they ran (#436).
 *
 * The six templates are seeded in `weight_room_workout_templates` under exactly
 * the names the notes use, so this only has to cover the spellings that drift:
 * `Leg Day 2` for `Legs Day 2` across three sessions in early 2023.
 *
 * Titles absent here are genuinely untemplated — standalone pull-up, leg-press
 * and plyo days that were never part of the rotation — and stay unlinked rather
 * than being forced onto the nearest template.
 */
const TEMPLATE_TITLE_ALIASES = Object.freeze({
  'leg day 2': 'Legs Day 2',
})

/**
 * Resolve the template a note's title names.
 *
 * @param {string} title Note title, as written.
 * @returns {string|null} The canonical template name, or null when the note is
 *   not one of the six — which most standalone notes are not.
 */
export function templateNameForNote(title) {
  const trimmed = String(title ?? '').trim()
  const canonical = TEMPLATE_TITLE_ALIASES[trimmed.toLowerCase()]
  if (canonical) return canonical
  return /^(chest|back|legs) day [12]$/i.test(trimmed)
    ? trimmed.replace(/\b\w/g, char => char.toUpperCase()).replace(/Day/i, 'Day')
    : null
}

/**
 * Reps in one 21s set, counted the way every other two-dumbbell set is (#435).
 *
 * The protocol is 7 reps with one arm while the other holds mid-curl, 7 with
 * the other, then 7 with both — 21 curls in total, but **14 per arm**. Every
 * other dumbbell movement in this log stores reps *per arm* and lets the
 * catalog's `load_multiplier` of 2 account for the second one, so a straight
 * set of 10 curls is `reps = 10` and tonnage comes out as `10 × weight × 2`.
 *
 * Storing 21 here would put all 21 through that same doubling and bill 42
 * arm-reps for work that was 28. 14 keeps the arithmetic honest and consistent;
 * the `21s` variant preserves that it was the protocol rather than a straight
 * set of 14.
 */
export const TWENTY_ONES_REPS_PER_ARM = 14

/**
 * Box height stated in a plyo movement's name, e.g. `24 inch plyo`.
 *
 * Kept as the set's variant rather than as three near-duplicate slugs: a box
 * jump is one movement, and the height is what changes between sets — the same
 * role grip and tempo play for other movements.
 */
const PLYO_HEIGHT = /(\d+)\s*inch/i

/**
 * The variant a movement's wording implies, if any.
 *
 * @param {string} name Movement name as written in the note.
 * @param {string} slug The slug it resolved to.
 * @returns {string|null} A lowercase variant, or null when the name adds nothing.
 */
export function variantFor(name, slug) {
  if (slug !== 'box-jump') return null
  const height = String(name ?? '').match(PLYO_HEIGHT)
  return height ? `${height[1]} inch` : null
}

/**
 * The alias table keyed the way lookups arrive.
 *
 * Built by pushing {@link RAW_MOVEMENT_ALIASES}' human-readable keys through
 * {@link normalizeName}, so both sides of every comparison are normalized by
 * the same code. Writing the keys pre-normalized by hand looks equivalent and
 * is not: `normalizeName` strips one trailing `s`, which turns every `…Press`
 * into `…pres`, and a hand-written `barbellbenchpress` silently never matches.
 */
export const MOVEMENT_ALIASES = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_MOVEMENT_ALIASES).map(([name, slug]) => [normalizeName(name), slug])
  )
)

/**
 * Slugs whose catalog `load_multiplier` is 2 — two implements move per set.
 *
 * Only these can meaningfully carry a `Weight (total)` column, and only these
 * get halved when one appears. Mirrors the catalog rather than replacing it;
 * {@link perImplementWeight} takes the live multiplier when the caller has it.
 */
export const TWO_IMPLEMENT_SLUGS = Object.freeze(
  new Set([
    'dumbbell-bench-press',
    'dumbbell-incline-press',
    'dumbbell-shoulder-press',
    'dumbbell-lateral-raise',
    'dumbbell-curl',
    'dumbbell-lunge',
    'dumbbell-romanian-deadlift',
    'farmers-carry',
    'shrugs',
  ])
)

/**
 * Movements that are bodyweight grease-the-groove staples in this log.
 *
 * A bare rep list under one of these names is daily volume, not part of the
 * session it happens to sit inside — see {@link parseNote}.
 */
export const GTG_MOVEMENTS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      'Pull ups': 'pullups',
      'Push ups': 'pushups',
      Squats: 'squats',
      Dips: 'dips',
    }).map(([name, slug]) => [normalizeName(name), slug])
  )
)

/**
 * Collapse a note's free-hand movement name to a lookup key.
 *
 * Strips case, whitespace and punctuation, then a single trailing `s`, so
 * `"Barbell Bent Over Rows"`, `"barbell bent-over row"` and `"BARBELL BENT OVER
 * ROW"` all reach the same entry. Deliberately blunt: the alias table is the
 * place for real synonyms, and a cleverer normalizer would start silently
 * equating movements that differ by one word.
 *
 * @param {string} raw Movement name exactly as written in the note.
 * @returns {string} Lookup key; `''` when the input is not a usable string.
 */
export function normalizeName(raw) {
  if (typeof raw !== 'string') return ''
  const stripped = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
  return stripped.endsWith('s') ? stripped.slice(0, -1) : stripped
}

/**
 * Resolve a movement named in an exercise **table** to a catalog slug.
 *
 * Table entries are gym work, which is what makes `Squats` safe to send to
 * `barbell-back-squat` here: a loaded barbell squat and the bodyweight `squats`
 * that feed the daily ring are different movements that share a word, and
 * #400 calls out mapping the former onto the latter as the way this import
 * quietly corrupts the grease-the-groove streak.
 *
 * @param {string} name Movement name as written in the note.
 * @returns {string|null} Catalog slug, or null when nothing matches — callers
 *   report those rather than guessing a near-duplicate slug into existence.
 */
export function resolveTableMovement(name) {
  const key = normalizeName(name)
  if (!key) return null
  return MOVEMENT_ALIASES[key] ?? null
}

/**
 * Resolve a movement named above a bare **rep list** to a catalog slug.
 *
 * The mirror image of {@link resolveTableMovement}, and the reason the two are
 * separate functions: an unloaded rep list of `Squats` is the bodyweight
 * movement, so the same word has to resolve differently depending on which
 * shape it appeared in. Anything outside the small grease-the-groove set falls
 * through to the table mapping, since a rep list under `Dips` is still dips.
 *
 * @param {string} name Movement name as written above the rep list.
 * @returns {string|null} Catalog slug, or null when nothing matches.
 */
export function resolveRepListMovement(name) {
  const key = normalizeName(name)
  if (!key) return null
  return GTG_MOVEMENTS[key] ?? MOVEMENT_ALIASES[key] ?? null
}

/**
 * Convert a transcribed Weight cell into the per-implement load the schema wants.
 *
 * `weight_room_sets.weight_lbs` is per implement — a 60 lb dumbbell shrug is
 * 60, and the catalog's `load_multiplier` supplies the ×2 when tonnage is
 * computed. The notes are not consistent about this: most tables head the
 * column `Weight` and mean per hand, but some head it `Weight (total)` and mean
 * the pair. Importing a `(total)` figure verbatim records double the real load,
 * and nothing downstream would look wrong — which is why the header is read per
 * table rather than assumed once.
 *
 * @param {number|string|null|undefined} raw The Weight cell. `'BW'` (bodyweight)
 *   and blanks both become null, which is what the schema uses for unloaded work.
 * @param {string|null|undefined} header The column header verbatim, e.g.
 *   `'Weight'` or `'Weight (total)'`.
 * @param {string} slug Catalog slug the row resolved to.
 * @param {number} [loadMultiplier] The catalog's live multiplier for `slug`.
 *   Defaults to 2 for {@link TWO_IMPLEMENT_SLUGS} and 1 otherwise.
 * @returns {number|null} Per-implement pounds, or null for bodyweight/blank.
 */
export function perImplementWeight(raw, header, slug, loadMultiplier) {
  if (raw === null || raw === undefined || raw === '') return null

  const text = String(raw).trim()
  if (text === '') return null
  if (/^bw$/i.test(text)) return null

  // Assistance, not load. `BW - 40` and `BW assisted` describe a dip made
  // *easier* by 40 lb of counterweight; reading the number as added weight
  // would record the opposite of what happened.
  if (/assist/i.test(text)) return null
  if (/^bw\s*-\s*\d/i.test(text)) return null

  // Tolerate "135 lb", "37.5lbs", "22.5 DB" — the notes are handwritten.
  const match = text.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number(match[0])
  if (!Number.isFinite(value) || value < 0) return null

  const multiplier =
    typeof loadMultiplier === 'number' && loadMultiplier > 0
      ? loadMultiplier
      : TWO_IMPLEMENT_SLUGS.has(slug)
        ? 2
        : 1

  const isTotal = typeof header === 'string' && /\(\s*total\s*\)/i.test(header)
  if (isTotal && multiplier > 1) {
    return value / multiplier
  }
  return value
}

/**
 * Read a rep count out of a hand-written measure cell.
 *
 * The cell is not always a bare number. Unilateral work is annotated in place —
 * `10 Each leg`, `8each leg`, `10 each leg` — and taking `Number()` of those
 * yields `NaN`, which would silently drop every set of walking lunges, one-leg
 * RDLs and step-ups from the import. The leading integer is the count; the
 * annotation says it was per side, which the catalog already records as
 * `is_unilateral`.
 *
 * A cell with no leading number (`Each leg` alone, `Hanging Knee tuck`) is not
 * a count and yields null.
 *
 * @param {unknown} raw The measure cell.
 * @returns {number|null} The rep count, or null when the cell records none.
 */
export function parseReps(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null
  if (typeof raw !== 'string') return null
  const match = raw.trim().match(/^(\d{1,3})\b/)
  if (!match) return null
  const reps = Number(match[1])
  return Number.isFinite(reps) && reps > 0 ? reps : null
}

/**
 * Whether a transcribed table row records a set that actually happened.
 *
 * The templates carry more rows than were ever used — a `Pull ups 4 sets` table
 * can run to eighteen numbered rows with `BW` pre-filled down the Weight column
 * and the Reps left blank. Those are stationery, not training, and importing
 * them would invent sets. Reps is the discriminator: no reps, no set.
 *
 * @param {{set?: unknown, weight?: unknown, reps?: unknown}} row A transcribed row.
 * @returns {boolean} True when the row carries a positive rep count.
 */
export function isPerformedSet(row) {
  if (!row || typeof row !== 'object') return false
  return parseReps(row.reps) !== null
}

/**
 * Movements performed as a held position rather than for repetitions.
 *
 * The measure is time whatever column it arrived in, which matters because this
 * log wrote planks three ways across the years: a `Time (seconds)` table
 * column, a bare list of numbers under `Planks`, and `45 seconds` spelled out
 * per set. Keying off the *movement* rather than the column catches all three —
 * the freeform shapes carry no header to inspect, and they are how 12 sets
 * claiming "50 reps" of plank got in.
 */
const ISOMETRIC_HOLDS = Object.freeze(new Set(['plank']))

/**
 * Whether a movement is held rather than repeated.
 *
 * @param {string} slug Catalog slug.
 * @returns {boolean} True when its numbers are seconds.
 */
export function isIsometricHold(slug) {
  return ISOMETRIC_HOLDS.has(slug)
}

/**
 * Third-column headers that measure time rather than repetitions.
 *
 * A plank's `Time (seconds)` column holds 45; storing that as `reps` records
 * forty-five plank repetitions.
 */
const TIME_MEASURE = /^time\b/i

/**
 * Whether a table's measure column counts something `reps` can hold.
 *
 * @param {string|null|undefined} header The third column header, verbatim.
 * @returns {boolean} False for duration columns. `Steps` is true — a
 *   walking-lunge step *is* a rep of the movement.
 */
export function isRepMeasure(header) {
  return !TIME_MEASURE.test(String(header ?? '').trim())
}

/**
 * Read a duration out of a hand-written cell.
 *
 * Tolerates the units the notes spell out (`45 seconds`, `40 sec`) as well as a
 * bare number, since both shapes appear for the same movement.
 *
 * @param {unknown} raw The cell.
 * @returns {number|null} Seconds, or null when the cell holds no number.
 */
export function parseDuration(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : null
  if (typeof raw !== 'string') return null
  const match = raw.trim().match(/^(\d{1,4})\b/)
  if (!match) return null
  const seconds = Number(match[1])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

/**
 * Normalize the date shown against a note in the iCloud list to `YYYY-MM-DD`.
 *
 * The list renders US short dates (`4/16/24`), and the export manifest uses
 * `MM-DD-YYYY`; both have to reach the same key for a note to find its
 * timestamps. Two-digit years resolve into the 2000s, which is safe here — the
 * account's notes begin in 2018 and the training log ends in 2024.
 *
 * @param {string} raw The date as written, e.g. `'4/16/24'` or `'2024-04-16'`.
 * @returns {string|null} `YYYY-MM-DD`, or null when it is not a date. A
 *   relative label like `'Yesterday'` — which iCloud shows for recent notes —
 *   returns null rather than a guess.
 */
export function parseNoteDate(raw) {
  if (typeof raw !== 'string') return null
  const text = raw.trim()

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return text

  const slashed = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!slashed) return null

  const [, month, day, year] = slashed
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year)
  if (Number(month) < 1 || Number(month) > 12) return null
  if (Number(day) < 1 || Number(day) > 31) return null

  return `${fullYear}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
}

/**
 * Mint the deterministic key that makes re-importing a note converge.
 *
 * A set has no natural key of its own — the same movement at the same weight
 * for the same reps legitimately repeats within a session, and `logged_at` is
 * derived rather than observed, so it cannot separate them. Identity therefore
 * comes from where the set sits in the source note, which is stable across
 * re-runs as long as the note is unchanged.
 *
 * @param {object} parts Key components.
 * @param {string} parts.title Note title, e.g. `'Back Day 1'`.
 * @param {string} parts.date Note date as `YYYY-MM-DD`.
 * @param {string} parts.slug Catalog slug the set resolved to.
 * @param {number} parts.index 0-based position of this set within its movement.
 * @returns {string} Key of the form `icloud:<title>:<date>:<slug>:<index>`.
 */
export function mintImportKey({ title, date, slug, index }) {
  return `icloud:${title}:${date}:${slug}:${index}`
}

/**
 * Turn a `Set N:` block — a rack run or a set of 21s — into sets (#435).
 *
 * Both are dumbbell curls that a `Set | Weight | Reps` table cannot express,
 * and both record loads where a table would record reps.
 *
 * **Rack run.** A drop set: curl the 35s to failure, drop to the 30s, again,
 * down the rack. `Set 1: 25, 20, 10` is three drops at three loads, and the rep
 * count was never written because each drop simply went until it couldn't.
 * Every drop is therefore a set marked `to_failure` with `reps: null` — the
 * count was never measured, and #440 made the column nullable so it no longer
 * has to be invented. Drops of one pass share a `set_group`, so the pass counts
 * as the single set it was rather than as one set per drop.
 *
 * A `Set N:` with nothing after it is the same movement performed with nothing
 * recorded at all. It still happened — the heading declared it and the label is
 * there — so it imports as one unloaded to-failure set rather than vanishing.
 * That is the two shapes the source actually has: one with loads, one without.
 *
 * **21s.** One set at one load, for {@link TWENTY_ONES_REPS_PER_ARM} reps.
 *
 * @param {{movement: string, planned?: string,
 *   sets: Array<{set: number, value: string}>}} block A parsed labelled block.
 * @param {Record<string, number>} [loadMultipliers] Live catalog multipliers.
 * @param {number} [groupBase] Offset added to each `Set N:` number so groups
 *   stay distinct across two labelled blocks in one note.
 * @returns {Array<{exercise: string, reps: number|null, weight_lbs: number|null,
 *   variant: string, to_failure?: boolean, set_group?: number}>} Sets in the
 *   order they were run.
 */
export function parseLabelledBlock(block, loadMultipliers = {}, groupBase = 0) {
  const isRackRun = /^rack run/i.test(block.movement)
  const slug = 'dumbbell-curl'
  const variant = isRackRun ? 'rack run' : '21s'
  const out = []

  for (const entry of block.sets ?? []) {
    // Loads are comma-separated: `25, 20, 10` is three drops, `22.5 DB` is one.
    const loads = entry.value
      .split(',')
      .map(part => part.trim())
      .filter(part => part !== '')

    if (!isRackRun) {
      // 21s: a value of bare `DB` names the implement without a load, which is
      // a set that happened at a weight nobody wrote down.
      const weight = perImplementWeight(loads[0], 'Weight', slug, loadMultipliers[slug])
      out.push({
        exercise: slug,
        reps: TWENTY_ONES_REPS_PER_ARM,
        weight_lbs: weight,
        variant,
      })
      continue
    }

    // One group per pass down the rack, so the drops below collapse back into
    // the single set they were (#440).
    //
    // Offset by the block's own base rather than using `entry.set` directly:
    // a note carrying two Rack Run blocks would otherwise give both a
    // `Set 1:`, and the two passes would collide into one group and count as
    // a single set. No note in the archive does this today, which is exactly
    // why it would go unnoticed.
    const setGroup = groupBase + entry.set

    if (loads.length === 0) {
      out.push({
        exercise: slug,
        reps: null,
        weight_lbs: null,
        variant,
        to_failure: true,
        set_group: setGroup,
      })
      continue
    }

    for (const load of loads) {
      out.push({
        exercise: slug,
        reps: null,
        weight_lbs: perImplementWeight(load, 'Weight', slug, loadMultipliers[slug]),
        variant,
        to_failure: true,
        set_group: setGroup,
      })
    }
  }

  return out
}

/**
 * Turn one transcribed note into the sets it records.
 *
 * Splits into two piles, which is the distinction #400 flags as easiest to get
 * wrong. Table entries are the session's own work and carry a `workout`
 * disposition. Bare rep lists are grease-the-groove volume — pull-ups and
 * push-ups ran at 100/day for a stretch, so they appear under nearly every
 * session note without belonging to it — and carry a `gtg` disposition so the
 * caller can leave `workout_id` null. The same movement can be both on
 * different days, so the discriminator is the shape it was written in, per
 * note, not the movement's name.
 *
 * @param {object} note A transcribed note.
 * @param {string} note.title Note title.
 * @param {string} note.date Note date as `YYYY-MM-DD`.
 * @param {Array<{name: string, weight_header?: string|null,
 *   measure_header?: string|null,
 *   sets?: Array<{set?: number, weight?: unknown, reps?: unknown}>}>} [note.exercises]
 *   Table-backed exercises. `measure_header` distinguishes a rep column from a
 *   duration one — see {@link isRepMeasure}.
 * @param {Array<{movement: string, reps?: unknown[]}>} [note.rep_lists]
 *   Bare rep lists.
 * @param {Array<{movement: string, planned?: string,
 *   sets: Array<{set: number, value: string}>}>} [note.labelled_blocks]
 *   `Set N:` blocks — rack runs and 21s (#435); see {@link parseLabelledBlock}.
 * @param {Record<string, number>} [loadMultipliers] Live catalog multipliers
 *   keyed by slug. Falls back to {@link TWO_IMPLEMENT_SLUGS} when absent.
 * @returns {{sets: Array<{exercise: string, reps: number|null, weight_lbs: number|null,
 *   variant?: string, duration_seconds?: number, to_failure?: boolean,
 *   set_group?: number,
 *   disposition: 'workout'|'gtg', position: number|null, import_key: string}>,
 *   unmapped: string[], timed: string[]}} Parsed sets in note order; every
 *   movement name that resolved to nothing — reported so it gets a real catalog
 *   row rather than a near-duplicate slug; and every duration-measured movement
 *   skipped for want of a rep count.
 */
export function parseNote(note, loadMultipliers = {}) {
  const sets = []
  const unmapped = []
  const timed = []
  let position = 0

  // Import-key indexes run per movement across the *whole* note, not per block.
  // One note can log the same movement twice — `Shrugs / 35 DB / 20 / 20` then
  // `40 DB / 12 / 12` is two blocks of shrugs — and restarting the count in the
  // second block mints keys the first block already used, which the unique
  // index rejects and the import fails on.
  const seen = new Map()
  const nextIndex = key => {
    const index = seen.get(key) ?? 0
    seen.set(key, index + 1)
    return index
  }

  for (const exercise of note.exercises ?? []) {
    const slug = resolveTableMovement(exercise.name)
    if (!slug) {
      unmapped.push(exercise.name)
      continue
    }
    // A hold is measured in seconds however it was written — see
    // isIsometricHold. A duration column on any other movement is a shape this
    // parser has no rule for, so it is reported rather than guessed at.
    const held = isIsometricHold(slug)
    if (!held && !isRepMeasure(exercise.measure_header)) {
      timed.push(exercise.name)
      continue
    }

    const variant = variantFor(exercise.name, slug)
    const performed = (exercise.sets ?? []).filter(row =>
      held ? parseDuration(row.reps) !== null : isPerformedSet(row)
    )
    performed.forEach(row => {
      const index = nextIndex(slug)
      const duration = held ? parseDuration(row.reps) : null
      sets.push({
        exercise: slug,
        ...(variant === null ? {} : { variant }),
        // One repetition of the hold, lasting `duration_seconds` — see the
        // #400 duration migration for why `reps` stays populated.
        reps: held ? 1 : parseReps(row.reps),
        ...(duration === null ? {} : { duration_seconds: duration }),
        weight_lbs: perImplementWeight(
          row.weight,
          exercise.weight_header,
          slug,
          loadMultipliers[slug]
        ),
        disposition: 'workout',
        position: position++,
        import_key: mintImportKey({
          title: note.title,
          date: note.date,
          slug,
          index,
        }),
      })
    })
  }

  // Each labelled block gets a group range of its own, so two Rack Run
  // blocks in one note cannot both claim group 1 (#440).
  let groupBase = 0
  for (const block of note.labelled_blocks ?? []) {
    const parsed = parseLabelledBlock(block, loadMultipliers, groupBase)
    groupBase += (block.sets ?? []).length + 1
    for (const set of parsed) {
      sets.push({
        ...set,
        disposition: 'workout',
        position: position++,
        import_key: mintImportKey({
          title: note.title,
          date: note.date,
          slug: set.exercise,
          index: nextIndex(set.exercise),
        }),
      })
    }
  }

  for (const list of note.rep_lists ?? []) {
    const slug = resolveRepListMovement(list.movement)
    if (!slug) {
      unmapped.push(list.movement)
      continue
    }

    const listVariant = variantFor(list.movement, slug)
    const reps = (list.reps ?? [])
      .map(value => (typeof value === 'string' ? Number(value) : value))
      .filter(value => typeof value === 'number' && Number.isFinite(value) && value > 0)

    // A bare list under `Planks` is seconds per hold, not reps — the shape that
    // slipped past the column check and landed "50 reps" of plank.
    const heldList = isIsometricHold(slug)
    reps.forEach(count => {
      const index = nextIndex(`gtg:${slug}`)
      sets.push({
        exercise: slug,
        ...(listVariant === null ? {} : { variant: listVariant }),
        reps: heldList ? 1 : count,
        ...(heldList ? { duration_seconds: count } : {}),
        weight_lbs: null,
        disposition: 'gtg',
        position: null,
        // `gtg:` keeps a rep list from colliding with a table of the same
        // movement in the same note — Chest Day 2 has both push-up shapes.
        import_key: mintImportKey({
          title: note.title,
          date: note.date,
          slug: `gtg:${slug}`,
          index,
        }),
      })
    })
  }

  return { sets, unmapped, timed }
}
