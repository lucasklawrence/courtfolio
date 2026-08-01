import type { FocusCategory, MonthlyFocus, StrengthSet } from '@/types/weight-room'
import { inclusiveDaySpan, pacificDayKey, safePacificDayKey, shiftDayKey } from './day-keys'

export type { FocusCategory }

/**
 * Pure helpers for the "grease the groove" monthly focus (#255) — which
 * focus is active on a given day, which are still upcoming, windowed
 * adherence, and load stats for weighted focuses. Kept separate from the
 * React surfaces so the date/window math is unit-tested without a DOM,
 * mirroring `strength-today.ts` / `strength-streaks.ts`.
 *
 * All window math compares bare `YYYY-MM-DD` keys. PostgREST renders a
 * Postgres `date` in that canonical form, and {@link pacificDayKey}
 * produces it for set timestamps, so lexicographic string comparison is
 * exactly chronological comparison — no `Date` parsing needed for the
 * inclusive `start <= day <= end` test. Pacific is used throughout (same
 * anchor as `load-management.ts` and `achievements.ts`, #319) so a set
 * logged at 10 pm Pacific isn't displaced onto the following UTC day when
 * this module runs inside a Vercel Server Component.
 */


/**
 * Whether a focus window covers `dayKey` (inclusive on both ends).
 *
 * @param focus The focus whose `[start_date, end_date]` window to test.
 * @param dayKey `YYYY-MM-DD` key, e.g. from {@link pacificDayKey}. An
 *   empty string (unparseable "today") is never in-window.
 */
export function isFocusActiveOnDay(focus: MonthlyFocus, dayKey: string): boolean {
  if (dayKey === '') return false
  return focus.start_date <= dayKey && dayKey <= focus.end_date
}

/** Render + resolution order for concurrent focuses: upper lane first. */
const FOCUS_CATEGORY_ORDER: readonly FocusCategory[] = ['upper', 'lower']

/**
 * The active focuses on `dayKey` — at most one per {@link FocusCategory}
 * (#286), so an upper-body and a lower-body campaign can run concurrently.
 * Within a lane the most recently started focus wins, so a deliberately
 * overlapping replacement supersedes the one it replaces (the pre-#286
 * single-slot rule, now applied per lane rather than globally). Returned in
 * {@link FOCUS_CATEGORY_ORDER} (upper before lower) so rendering is stable.
 *
 * @param focuses All configured focuses, usually `WeightRoomData.monthly_focus`.
 * @param dayKey `YYYY-MM-DD` key for the viewed day; `''` (an unparseable
 *   "today") yields an empty array.
 */
export function activeFocusesForDay(
  focuses: readonly MonthlyFocus[],
  dayKey: string,
): MonthlyFocus[] {
  const byCategory = new Map<FocusCategory, MonthlyFocus>()
  for (const focus of focuses) {
    if (!isFocusActiveOnDay(focus, dayKey)) continue
    const current = byCategory.get(focus.category)
    if (current === undefined || focus.start_date > current.start_date) {
      byCategory.set(focus.category, focus)
    }
  }
  return FOCUS_CATEGORY_ORDER.flatMap((category) => {
    const focus = byCategory.get(category)
    return focus ? [focus] : []
  })
}

/**
 * Focuses whose window starts strictly after `dayKey`, soonest first.
 * Powers the Today View "Upcoming" strip — the roadmap of what's queued.
 *
 * @param focuses All configured focuses, usually `WeightRoomData.monthly_focus`.
 * @param dayKey `YYYY-MM-DD` key for the viewed day. An empty string
 *   yields an empty list (defensive against an unparseable clock).
 */
export function upcomingFocuses(
  focuses: readonly MonthlyFocus[],
  dayKey: string,
): MonthlyFocus[] {
  if (dayKey === '') return []
  return focuses
    .filter((focus) => focus.start_date > dayKey)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0))
}

/**
 * Format a focus's `[start_date, end_date]` window as a short human
 * range, e.g. `Jul 1 – Jul 31` (or `Dec 15 – Jan 12` across a month/year
 * boundary). Each bare `YYYY-MM-DD` is parsed at local noon so the range
 * isn't shifted by the viewer's UTC offset, matching the rest of this
 * module's date handling. Falls back to the raw ISO keys if either date
 * is unparseable. No year is shown — the rotation is near-term and the
 * label stays compact; callers wanting the year can read `start_date`.
 *
 * @param focus The focus whose window to label.
 */
export function formatFocusWindow(focus: MonthlyFocus): string {
  const start = new Date(focus.start_date + 'T12:00:00')
  const end = new Date(focus.end_date + 'T12:00:00')
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return `${focus.start_date} – ${focus.end_date}`
  }
  const short = (d: Date): string =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${short(start)} – ${short(end)}`
}

/**
 * Per-day target attainment for one focus, restricted to its window up
 * to "today". A day counts as hit when the day's logged volume reaches
 * {@link MonthlyFocus.daily_target} — interpreted as total reps for
 * `target_kind: 'reps'` or distinct logged sets for `'sets'`.
 */
export interface FocusAdherence {
  /** Total calendar days in the focus window `[start_date, end_date]`. */
  daysInWindow: number
  /**
   * Days from `start_date` through the earlier of today and `end_date`,
   * inclusive. `0` before the window starts; equals `daysInWindow` once
   * the window has fully elapsed. The denominator for {@link percent}.
   */
  daysElapsed: number
  /** Count of elapsed days whose volume met the daily target. */
  daysHit: number
  /**
   * Consecutive hit days ending on the most recent elapsed day (today,
   * or `end_date` if the window is over). `0` if the latest elapsed day
   * was missed.
   */
  currentStreak: number
  /** `daysHit / daysElapsed`, or `0` when no day has elapsed yet. */
  percent: number
}

/**
 * Compute windowed adherence for a focus from the full set log.
 *
 * @param focus The focus to score.
 * @param sets All logged sets, usually `WeightRoomData.sets`; filtered to
 *   this focus's `exercise` and window internally.
 * @param now Clock for "today". Defaults to `new Date()`; pass a fixed
 *   instant in unit tests to keep assertions stable over real time. The
 *   day key is derived via {@link pacificDayKey} so that server-rendered
 *   pages (Vercel UTC) and the user's browser agree on "today" (#319).
 */
export function computeFocusAdherence(
  focus: MonthlyFocus,
  sets: readonly StrengthSet[],
  now: Date = new Date(),
): FocusAdherence {
  const daysInWindow = inclusiveDaySpan(focus.start_date, focus.end_date)
  const today = pacificDayKey(now)

  // Last elapsed day = min(today, end_date); nothing elapsed if today is
  // before the window opens.
  const lastElapsed =
    today === '' || today < focus.start_date
      ? ''
      : today < focus.end_date
        ? today
        : focus.end_date

  if (lastElapsed === '') {
    return { daysInWindow, daysElapsed: 0, daysHit: 0, currentStreak: 0, percent: 0 }
  }

  const daysElapsed = inclusiveDaySpan(focus.start_date, lastElapsed)

  // Bucket this focus's in-window volume by day.
  const volumeByDay = new Map<string, number>()
  for (const s of sets) {
    if (s.exercise !== focus.exercise) continue
    const day = safePacificDayKey(s.logged_at)
    if (day === '' || day < focus.start_date || day > lastElapsed) continue
    const increment = focus.target_kind === 'sets' ? 1 : s.reps
    volumeByDay.set(day, (volumeByDay.get(day) ?? 0) + increment)
  }

  const hit = (day: string): boolean => (volumeByDay.get(day) ?? 0) >= focus.daily_target

  let daysHit = 0
  for (const total of volumeByDay.values()) {
    if (total >= focus.daily_target) daysHit++
  }

  // Current streak walks backward from the last elapsed day.
  let currentStreak = 0
  let cursor = lastElapsed
  while (cursor >= focus.start_date && hit(cursor)) {
    currentStreak++
    cursor = shiftDayKey(cursor, -1)
  }

  return {
    daysInWindow,
    daysElapsed,
    daysHit,
    currentStreak,
    percent: daysElapsed === 0 ? 0 : daysHit / daysElapsed,
  }
}

/**
 * Load summary for a weighted focus, across all of its in-window sets.
 * All `null`/`0` when the focus is bodyweight (no set carries a
 * `weight_lbs`).
 */
export interface FocusLoadStats {
  /**
   * Heaviest single set's load in lbs **per implement**, or `null` if no
   * weighted sets — the number stamped on the dumbbell, which is how the load
   * is read off the equipment and stated ("60 lb DBs"). Deliberately *not*
   * multiplied by `loadMultiplier`: see {@link computeFocusLoadStats}.
   */
  topSetLbs: number | null
  /**
   * Mean per-implement load across weighted sets in lbs (unrounded), or `null`
   * if none. Only sets that carry a `weight_lbs` count toward the average —
   * an unweighted warmup set doesn't drag it down.
   */
  avgLoadLbs: number | null
  /**
   * Total tonnage in lbs = Σ `reps × weight_lbs × loadMultiplier` over weighted
   * sets — the *actual* weight moved, counting every implement. A two-dumbbell
   * shrug moves both, so its tonnage is double the per-hand arithmetic.
   */
  tonnageLbs: number
  /** Number of in-window sets that carried a load. */
  weightedSets: number
  /**
   * Implements moved per set, echoed back from the argument so a renderer can
   * show both readings of a load without re-plumbing the goal. `1` for a single
   * implement, in which case per-implement and total are the same number and
   * there's nothing extra to show.
   */
  loadMultiplier: number
}

/**
 * Compute load stats for a focus from the full set log, restricted to
 * the focus's `exercise` and `[start_date, end_date]` window.
 *
 * WHY TONNAGE AND LOAD DIVERGE: `weight_lbs` records one implement's load,
 * because that's how it's read off the equipment. "How heavy did you go?" is
 * naturally answered per-implement (you shrug the 60s), but "how much did you
 * move?" has to count both hands. So {@link FocusLoadStats.topSetLbs} and
 * {@link FocusLoadStats.avgLoadLbs} stay per-implement while
 * {@link FocusLoadStats.tonnageLbs} applies `loadMultiplier`.
 *
 * The Trophy Room's `load` measure makes the opposite choice — it reports total
 * pounds carried — because a badge threshold needs one unambiguous number and
 * its group header says which. Both are labeled where they're shown; the thing
 * that would be wrong is an *unlabeled* mix.
 *
 * @param focus The focus to summarize.
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param loadMultiplier Implements moved per set, from the matching
 *   {@link import('@/types/weight-room').ExerciseGoal.load_multiplier}.
 *   Defaults to `1` (single implement). Values below 1 are clamped up, so a bad
 *   config can't erase tonnage.
 */
export function computeFocusLoadStats(
  focus: MonthlyFocus,
  sets: readonly StrengthSet[],
  loadMultiplier = 1,
): FocusLoadStats {
  const implements_ = Math.max(1, loadMultiplier)
  let topSetLbs: number | null = null
  let loadSum = 0
  let tonnageLbs = 0
  let weightedSets = 0

  for (const s of sets) {
    if (s.exercise !== focus.exercise) continue
    const day = safePacificDayKey(s.logged_at)
    if (day === '' || day < focus.start_date || day > focus.end_date) continue
    if (s.weight_lbs == null) continue
    weightedSets++
    loadSum += s.weight_lbs
    tonnageLbs += s.reps * s.weight_lbs * implements_
    if (topSetLbs === null || s.weight_lbs > topSetLbs) topSetLbs = s.weight_lbs
  }

  return {
    topSetLbs,
    avgLoadLbs: weightedSets === 0 ? null : loadSum / weightedSets,
    tonnageLbs,
    weightedSets,
    loadMultiplier: implements_,
  }
}

// ---------------------------------------------------------------------------
// Combined lane heatmap helpers (#361)
// ---------------------------------------------------------------------------

/**
 * One day's slot in a stitched focus-lane heatmap. Each cell carries the
 * calendar day, which focus was active in the lane on that day (or `null`
 * for a gap between windows), and the normalized volume so the renderer
 * can pick an intensity bucket without re-running the arithmetic.
 */
export interface FocusDayCell {
  /** Local `YYYY-MM-DD` key for this calendar day. */
  dayKey: string
  /**
   * The focus active in this cell's body-region lane on `dayKey`, or
   * `null` when no focus window covers the day (a gap between rotations).
   * Gap cells still appear in the returned array so the renderer can emit
   * a visible break rather than silently collapsing the timeline.
   */
  focus: MonthlyFocus | null
  /**
   * Volume logged for `focus.exercise` on `dayKey`, interpreted per
   * `focus.target_kind`: total reps for `'reps'`, distinct set count for
   * `'sets'`. Always `0` for gap cells and days with no sets logged.
   */
  volume: number
  /**
   * `volume / focus.daily_target` — un-clamped so `1.0` means "exactly
   * hit the goal" and `>1.0` is an over-day. Always `0` for gap cells and
   * days with no sets logged.
   */
  pct: number
}

/**
 * Build the ordered sequence of {@link FocusDayCell}s for one body-region
 * lane (`category`), running from the earliest focus `start_date` through
 * `today`. Used by the History page's "Grease the Groove Rotation" combined
 * heatmap lane (#361).
 *
 * **Performance:** `sets` is pre-bucketed into `Map<string, number>` keyed
 * by `${exercise}|${dayKey}` before the day-iteration loop, keeping the
 * overall cost at O(sets + days) rather than O(sets × days).
 *
 * **Gap cells:** if no focus window covers a day in `[earliestStart, today]`,
 * the cell is emitted with `focus: null, volume: 0, pct: 0` so the renderer
 * can draw a visible gap rather than silently collapsing the timeline.
 *
 * @param focuses All configured focuses (across all categories); filtered to
 *   `category` internally.
 * @param sets All logged sets, usually `WeightRoomData.sets`.
 * @param category Body-region lane to build — `'upper'` or `'lower'`.
 * @param today Local `YYYY-MM-DD` key for the viewed day. An empty string
 *   or a key before the earliest focus window returns an empty array.
 */
export function buildFocusLaneCells(
  focuses: readonly MonthlyFocus[],
  sets: readonly StrengthSet[],
  category: FocusCategory,
  today: string,
): FocusDayCell[] {
  const laneFocuses = focuses.filter((f) => f.category === category)
  if (laneFocuses.length === 0 || today === '') return []

  let earliestStart = laneFocuses[0].start_date
  for (const f of laneFocuses) {
    if (f.start_date < earliestStart) earliestStart = f.start_date
  }

  if (today < earliestStart) return []

  // Pre-bucket sets by `${exercise}|${dayKey}` for O(sets + days) performance.
  const repsByKey = new Map<string, number>()
  const setCountByKey = new Map<string, number>()
  for (const s of sets) {
    const day = safePacificDayKey(s.logged_at)
    if (day === '') continue
    const k = `${s.exercise}|${day}`
    repsByKey.set(k, (repsByKey.get(k) ?? 0) + s.reps)
    setCountByKey.set(k, (setCountByKey.get(k) ?? 0) + 1)
  }

  const cells: FocusDayCell[] = []
  let cursor = earliestStart

  while (cursor <= today) {
    // `activeFocusesForDay` handles within-lane resolution; since `laneFocuses`
    // is already filtered to one category, at most one element is returned.
    const active = activeFocusesForDay(laneFocuses, cursor)
    const focus = active[0] ?? null

    if (focus === null) {
      cells.push({ dayKey: cursor, focus: null, volume: 0, pct: 0 })
    } else {
      const k = `${focus.exercise}|${cursor}`
      const volume =
        focus.target_kind === 'sets' ? (setCountByKey.get(k) ?? 0) : (repsByKey.get(k) ?? 0)
      const pct = focus.daily_target > 0 ? volume / focus.daily_target : 0
      cells.push({ dayKey: cursor, focus, volume, pct })
    }

    cursor = shiftDayKey(cursor, 1)
  }

  return cells
}

/**
 * Derive an effective-dated target history for a focus-anchored exercise from
 * its rotation windows (#367).
 *
 * A focus carries its own {@link MonthlyFocus.daily_target} scoped to
 * `[start_date, end_date]`, which is why focuses accidentally dodged the
 * re-scoring bug that #362 fixed for permanent goals. But the anchor
 * {@link import('@/types/weight-room').ExerciseGoal} still holds a single
 * scalar, so scoring a focus exercise through the normal rollups would use
 * that scalar for every day — wrong the moment two rotations of the same
 * exercise use different targets (July shrugs at 100, October at 150).
 *
 * Emitting one point per window start lets the focus exercise flow through
 * {@link import('./goal-targets').targetForDay} like any other goal, so there
 * is one resolution path rather than a parallel focus-only one.
 *
 * Days *between* windows resolve to the preceding window's target — an
 * off-campaign set still has a bar to clear, and the most recent campaign's is
 * the honest one. Days before the first window fall back to the earliest
 * target via `targetForDay`'s own before-first guard.
 *
 * **`target_kind: 'sets'` windows are excluded.** Their target counts distinct
 * sets, not reps, and every consumer of this history compares it against a
 * daily *rep* total — a 3-sets/day target would be satisfied by a single
 * 20-rep set. Omitting them means such a focus falls back to its anchor goal's
 * scalar (the pre-#367 reading) rather than being scored against the wrong
 * unit. `'sets'` is modeled but unused today; wiring it up needs a set-count
 * rollup, not a target here.
 *
 * @param focuses All configured focuses, usually `WeightRoomData.monthly_focus`.
 * @param exercise Exercise name to filter to.
 */
export function focusTargetHistory(
  focuses: readonly MonthlyFocus[],
  exercise: string,
): { daily_target: number; effective_from: string }[] {
  return focuses
    .filter(
      (focus) =>
        focus.exercise === exercise &&
        focus.daily_target > 0 &&
        focus.target_kind !== 'sets',
    )
    .map((focus) => ({
      daily_target: focus.daily_target,
      effective_from: focus.start_date,
    }))
    .sort((a, b) =>
      a.effective_from < b.effective_from ? -1 : a.effective_from > b.effective_from ? 1 : 0,
    )
}

/**
 * Campaign-scoped rollup for one focus-anchored exercise, aggregated across
 * *every* rotation it has run (#367).
 *
 * The stats panel is keyed by exercise, so shrugs gets one card no matter how
 * many times it has been the focus; per-window detail already lives in the GTG
 * section's `PastFocusCard`s and isn't restated here. Aggregating means "26 of
 * 31 days" becomes "52 of 62 days" once a second rotation runs, which is the
 * reading that matches an all-time streak sitting beside it.
 */
export interface FocusCampaignSummary {
  /**
   * Where this exercise's rotation sits relative to today:
   *
   * - `'active'` — a window covers today.
   * - `'upcoming'` — every window starts in the future. A scheduled campaign
   *   is a supported roadmap state (see `upcomingFocuses`), and must not be
   *   rendered as a finished one: it has zero elapsed days, so campaign-scoped
   *   cells would read a meaningless `0/0`.
   * - `'ended'` — the most recent window has closed.
   */
  status: 'active' | 'upcoming' | 'ended'
  /**
   * Whether a window covers today. Convenience mirror of
   * `status === 'active'`.
   */
  isActive: boolean
  /** How many rotations this exercise has had. */
  rotations: number
  /** Days hit, summed across every rotation's elapsed days. */
  daysHit: number
  /** Elapsed days, summed across every rotation — the denominator for adherence. */
  daysElapsed: number
  /** Reps logged inside any rotation window. Excludes off-campaign sets. */
  campaignReps: number
  /** Human window label for the most recent rotation, e.g. `Jul 1 – Jul 31`. */
  latestWindowLabel: string
}

/**
 * Summarize every rotation of one exercise into a {@link FocusCampaignSummary}.
 *
 * Returns `null` when the exercise has no focus windows, so a caller can treat
 * "not a focus" and "a focus with no campaigns yet" the same way — neither
 * should render focus chrome.
 *
 * @param focuses All configured focuses.
 * @param exercise Exercise name to summarize.
 * @param sets All logged sets; filtered to `exercise` and to window days.
 * @param now Clock for "today"; defaults to `new Date()`. Threaded from the
 *   caller so one fixed clock drives every rollup in a stats payload.
 */
export function summarizeFocusCampaigns(
  focuses: readonly MonthlyFocus[],
  exercise: string,
  sets: readonly StrengthSet[],
  now: Date = new Date(),
): FocusCampaignSummary | null {
  const windows = focuses
    .filter((focus) => focus.exercise === exercise)
    .sort((a, b) =>
      a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0,
    )
  if (windows.length === 0) return null

  const today = pacificDayKey(now)
  let daysHit = 0
  let daysElapsed = 0
  let isActive = false

  for (const focus of windows) {
    const adherence = computeFocusAdherence(focus, sets, now)
    daysHit += adherence.daysHit
    daysElapsed += adherence.daysElapsed
    if (isFocusActiveOnDay(focus, today)) isActive = true
  }

  // Reps inside *any* window. Counted once per set even if windows overlap —
  // two concurrent lanes are different exercises, so an overlap here would be
  // two rotations of the same movement, and double-counting a shared day would
  // overstate the campaign total.
  let campaignReps = 0
  for (const s of sets) {
    if (s.exercise !== exercise) continue
    const day = safePacificDayKey(s.logged_at)
    if (day === '') continue
    if (windows.some((focus) => isFocusActiveOnDay(focus, day))) campaignReps += s.reps
  }

  // "Upcoming" is every window still ahead of today — distinct from "ended",
  // which a bare `!isActive` would conflate, and which would render a
  // scheduled campaign as a finished one with `0/0` days hit.
  const allUpcoming = today !== '' && windows.every((focus) => today < focus.start_date)
  const status: FocusCampaignSummary['status'] = isActive
    ? 'active'
    : allUpcoming
      ? 'upcoming'
      : 'ended'

  return {
    status,
    isActive,
    rotations: windows.length,
    daysHit,
    daysElapsed,
    campaignReps,
    latestWindowLabel: formatFocusWindow(windows[windows.length - 1]),
  }
}
