'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent, type JSX } from 'react'

import { pacificDayKey } from '@/lib/training-facility/day-keys'
import { exerciseLabel } from '@/lib/training-facility/exercise-labels'
import { formatFocusWindow } from '@/lib/training-facility/monthly-focus'
import {
  WeightRoomMonthlyFocusCreateSchema,
  type WeightRoomMonthlyFocusCreate,
} from '@/lib/schemas/weight-room'
import type {
  ExerciseMuscleGroup,
  FocusCategory,
  MonthlyFocus,
  WeightRoomExercise,
} from '@/types/weight-room'

/** Props for {@link MonthlyFocusSettings}. */
export interface MonthlyFocusSettingsProps {
  /**
   * Every configured focus as read by the server component — past, active and
   * upcoming, in any order. The editor buckets them against today (Pacific).
   * Mutations refresh via `router.refresh()`, so this is always the server's
   * latest list rather than a client cache.
   */
  initialFocuses: readonly MonthlyFocus[]
  /**
   * Movements offered by the exercise picker. Pass live (non-archived) catalog
   * entries only: a focus on an archived movement would put a retired lift
   * back on the board.
   */
  exercises: readonly WeightRoomExercise[]
  /**
   * Clock for "today", injectable so tests can pin the active / upcoming /
   * past split. Defaults to the real time.
   */
  now?: Date
  /**
   * The server read failed, so {@link initialFocuses} is empty for lack of
   * data rather than because nothing is configured. Shows a load error in
   * place of the lists so an outage can't be mistaken for "no focuses" and
   * re-created as duplicates. Defaults to `false`.
   */
  loadFailed?: boolean
}

const DEFAULT_COLOR = '#C9A268'
const DEFAULT_TARGET = 50

const FIELD_CLASS =
  'rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none'

const LABEL_CLASS = 'flex flex-col gap-1 text-xs text-white/70'

const LABEL_TEXT_CLASS = 'font-mono uppercase tracking-[0.18em]'

/** Muscle groups that put a movement in the lower-body lane by default. */
const LOWER_BODY_GROUPS: ReadonlySet<ExerciseMuscleGroup> = new Set(['legs'])

/**
 * The lane a newly picked movement defaults to. Only a default: the admin can
 * override it, since `core` and `full-body` movements could sit in either.
 */
function defaultCategory(exercise: WeightRoomExercise | undefined): FocusCategory {
  return exercise !== undefined && LOWER_BODY_GROUPS.has(exercise.muscle_group) ? 'lower' : 'upper'
}

/**
 * A focus's window as a short label, with the year appended when the window
 * doesn't fall in the current year, so two Julys in the Past list (and in
 * their delete confirm / accessible name) stay distinguishable.
 */
function windowLabel(focus: MonthlyFocus, today: string): string {
  const year = today.slice(0, 4)
  const span = formatFocusWindow(focus)
  if (focus.start_date.startsWith(year) && focus.end_date.startsWith(year)) return span
  const startYear = focus.start_date.slice(0, 4)
  const endYear = focus.end_date.slice(0, 4)
  return startYear === endYear ? `${span}, ${startYear}` : `${span} (${startYear}–${endYear})`
}

/**
 * Focuses in `category` whose window shares at least one day with
 * `[start, end]`. The board shows only the later-started focus per lane on a
 * given day, so an overlap silently hides the other one's ring.
 */
function overlappingFocuses(
  focuses: readonly MonthlyFocus[],
  category: FocusCategory,
  start: string,
  end: string
): MonthlyFocus[] {
  return focuses.filter(
    focus => focus.category === category && focus.start_date <= end && start <= focus.end_date
  )
}

/** Focuses split by where their window sits relative to today. */
interface FocusBuckets {
  /** Windows covering today, earliest start first. */
  active: MonthlyFocus[]
  /** Windows starting after today, soonest first. */
  upcoming: MonthlyFocus[]
  /** Windows that ended before today, most recent first. */
  past: MonthlyFocus[]
}

/**
 * Bucket focuses by their window against `today`. Every focus lands in exactly
 * one bucket; two overlapping focuses in one lane are both listed as active
 * here, even though the board shows only the later-started one, because this
 * is the place to notice and remove the overlap.
 */
function bucketFocuses(focuses: readonly MonthlyFocus[], today: string): FocusBuckets {
  const byStart = (a: MonthlyFocus, b: MonthlyFocus): number =>
    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0
  const active: MonthlyFocus[] = []
  const upcoming: MonthlyFocus[] = []
  const past: MonthlyFocus[] = []
  for (const focus of focuses) {
    if (focus.start_date > today) upcoming.push(focus)
    else if (focus.end_date < today) past.push(focus)
    else active.push(focus)
  }
  active.sort(byStart)
  upcoming.sort(byStart)
  past.sort((a, b) => byStart(b, a))
  return { active, upcoming, past }
}

/**
 * Admin-only editor for "grease the groove" monthly focuses.
 * Lists every focus as active / upcoming / past and offers a form to queue a
 * new one, posting to `/api/admin/weight-room/monthly-focus` and deleting
 * through its `[id]` route. On success the page's server data refreshes via
 * `router.refresh()`, the same contract as the sibling Settings editors.
 *
 * There is no in-place edit: the API has no update route, and a focus is a
 * small enough record that delete-and-recreate is the honest way to change
 * one.
 */
export function MonthlyFocusSettings({
  initialFocuses,
  exercises,
  now,
  loadFailed = false,
}: MonthlyFocusSettingsProps): JSX.Element {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  // Covers the request itself; `isPending` only covers the refresh after it.
  // Without both, a double-click posts the same focus twice.
  const [submitting, setSubmitting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const busy = submitting || isPending

  const today = pacificDayKey(now ?? new Date())
  const { active, upcoming, past } = bucketFocuses(initialFocuses, today)

  function refresh(): void {
    startTransition(() => {
      router.refresh()
    })
  }

  /**
   * Run one admin request with the busy flag held and every failure mode,
   * including a rejected `fetch`, turned into the error banner.
   *
   * @returns whether the request succeeded.
   */
  async function send(url: string, init: RequestInit, failure: string): Promise<boolean> {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(url, init)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `${failure} (${res.status})`)
        return false
      }
      refresh()
      return true
    } catch {
      setError(`${failure}: couldn't reach the server. Check your connection and try again.`)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  /** @returns whether the focus was created, so the form keeps its input on failure. */
  async function createFocus(payload: MonthlyFocusDraft): Promise<boolean> {
    const clashes = overlappingFocuses(
      initialFocuses,
      payload.category,
      payload.start_date,
      payload.end_date
    )
    if (clashes.length > 0) {
      const names = clashes.map(f => `${exerciseLabel(f)} (${windowLabel(f, today)})`).join(', ')
      const ok = window.confirm(
        `This overlaps ${names} in the ${payload.category}-body lane. The board shows one focus per lane, the one that started last, so the other's ring disappears while both run. Add it anyway?`
      )
      if (!ok) return false
    }
    return send(
      '/api/admin/weight-room/monthly-focus',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'Save failed'
    )
  }

  async function deleteFocus(focus: MonthlyFocus): Promise<void> {
    const ok = window.confirm(
      `Remove the ${exerciseLabel(focus)} focus (${windowLabel(focus, today)})? Its logged sets and daily goal are kept; it just leaves the rotation and its campaign history.`
    )
    if (!ok) return
    await send(
      `/api/admin/weight-room/monthly-focus/${encodeURIComponent(focus.id)}`,
      { method: 'DELETE' },
      'Delete failed'
    )
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p
          role="alert"
          className="rounded border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[12px] text-rose-200"
        >
          {error}
        </p>
      ) : null}

      {loadFailed ? (
        <p
          role="status"
          className="rounded border border-amber-300/30 bg-amber-950/30 px-3 py-2 font-mono text-[12px] text-amber-100"
        >
          Couldn&rsquo;t load the current focuses. Reload before adding one, so you don&rsquo;t
          queue a duplicate.
        </p>
      ) : (
        <>
          <FocusList
            title="Active"
            emptyText="No focus running today."
            focuses={active}
            today={today}
            disabled={busy}
            onDelete={deleteFocus}
          />
          <FocusList
            title="Upcoming"
            emptyText="Nothing queued — add a focus below."
            focuses={upcoming}
            today={today}
            disabled={busy}
            onDelete={deleteFocus}
          />
          <FocusList
            title="Past"
            emptyText="No finished focuses yet."
            focuses={past}
            today={today}
            disabled={busy}
            onDelete={deleteFocus}
          />
        </>
      )}

      <section aria-labelledby="monthly-focus-add-heading">
        <h3
          id="monthly-focus-add-heading"
          className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80"
        >
          Add focus
        </h3>
        <AddFocusForm exercises={exercises} today={today} disabled={busy} onAdd={createFocus} />
      </section>
    </div>
  )
}

/** A validated create payload, as the admin route accepts it. */
type MonthlyFocusDraft = WeightRoomMonthlyFocusCreate

interface FocusListProps {
  title: string
  emptyText: string
  focuses: readonly MonthlyFocus[]
  /** Pacific `YYYY-MM-DD` key, for deciding when a window needs its year. */
  today: string
  disabled: boolean
  onDelete: (focus: MonthlyFocus) => Promise<void>
}

function FocusList({
  title,
  emptyText,
  focuses,
  today,
  disabled,
  onDelete,
}: FocusListProps): JSX.Element {
  const headingId = `monthly-focus-${title.toLowerCase()}-heading`
  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80"
      >
        {title}
      </h3>
      {focuses.length === 0 ? (
        <p className="mt-3 text-sm text-[#e8d5be]/70">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {focuses.map(focus => {
            const label = exerciseLabel(focus)
            const span = windowLabel(focus, today)
            return (
              <li
                key={focus.id}
                data-testid={`monthly-focus-${focus.id}`}
                className="flex flex-wrap items-center gap-3 rounded-[1.1rem] border border-white/10 bg-white/5 p-4 sm:gap-4"
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: focus.color }}
                />
                <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-white">
                  {label}
                </span>
                <span className="font-mono text-xs tabular-nums text-white/70">
                  {focus.daily_target} {focus.target_kind}/day
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-white/55">
                  {focus.category}
                </span>
                <span className="font-mono text-xs text-white/55">{span}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onDelete(focus)}
                  aria-label={`Delete the ${label} focus, ${span}`}
                  className="ml-auto rounded-full border border-rose-300/25 bg-rose-300/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

interface AddFocusFormProps {
  exercises: readonly WeightRoomExercise[]
  /** Pacific `YYYY-MM-DD` key, the default start date. */
  today: string
  disabled: boolean
  onAdd: (payload: MonthlyFocusDraft) => Promise<boolean>
}

function AddFocusForm({ exercises, today, disabled, onAdd }: AddFocusFormProps): JSX.Element {
  const [exercise, setExercise] = useState<string>('')
  const [target, setTarget] = useState<string>(String(DEFAULT_TARGET))
  const [targetKind, setTargetKind] = useState<'reps' | 'sets'>('reps')
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [category, setCategory] = useState<FocusCategory>('upper')
  const [startDate, setStartDate] = useState<string>(today)
  const [endDate, setEndDate] = useState<string>('')
  const [validation, setValidation] = useState<string | null>(null)

  function pickExercise(slug: string): void {
    setExercise(slug)
    setCategory(defaultCategory(exercises.find(e => e.slug === slug)))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    // The route validates with this same schema; checking here first turns a
    // round-trip 400 into an inline message next to the form.
    const parsed = WeightRoomMonthlyFocusCreateSchema.safeParse({
      exercise,
      daily_target: Number(target),
      target_kind: targetKind,
      color,
      category,
      start_date: startDate,
      end_date: endDate,
    })
    if (!parsed.success) {
      setValidation(parsed.error.issues[0]?.message ?? 'Check the focus fields.')
      return
    }
    setValidation(null)
    const created = await onAdd(parsed.data)
    if (!created) return
    setExercise('')
    setTarget(String(DEFAULT_TARGET))
    setTargetKind('reps')
    setColor(DEFAULT_COLOR)
    setCategory('upper')
    setStartDate(today)
    setEndDate('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-describedby={validation ? 'monthly-focus-validation' : undefined}
      className="mt-3 grid gap-3 rounded-[1.1rem] border border-white/10 bg-white/5 p-4 sm:grid-cols-2"
    >
      <label className={`${LABEL_CLASS} sm:col-span-2`}>
        <span className={LABEL_TEXT_CLASS}>exercise</span>
        <select
          required
          value={exercise}
          onChange={e => pickExercise(e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="" disabled>
            Pick a movement
          </option>
          {exercises.map(movement => (
            <option key={movement.slug} value={movement.slug}>
              {movement.display_name}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL_CLASS}>
        <span className={LABEL_TEXT_CLASS}>daily target</span>
        <input
          type="number"
          min={1}
          step={1}
          required
          value={target}
          onChange={e => setTarget(e.target.value)}
          className={`${FIELD_CLASS} text-right`}
        />
      </label>
      <label className={LABEL_CLASS}>
        <span className={LABEL_TEXT_CLASS}>counts</span>
        <select
          value={targetKind}
          onChange={e => setTargetKind(e.target.value as 'reps' | 'sets')}
          className={FIELD_CLASS}
        >
          <option value="reps">reps per day</option>
          <option value="sets">sets per day</option>
        </select>
      </label>
      <label className={LABEL_CLASS}>
        <span className={LABEL_TEXT_CLASS}>lane</span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as FocusCategory)}
          className={FIELD_CLASS}
        >
          <option value="upper">upper body</option>
          <option value="lower">lower body</option>
        </select>
      </label>
      <label className={LABEL_CLASS}>
        <span className={LABEL_TEXT_CLASS}>color</span>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="h-9 w-16 cursor-pointer rounded border border-white/15 bg-black/40"
        />
      </label>
      <label className={LABEL_CLASS}>
        <span className={LABEL_TEXT_CLASS}>starts</span>
        <input
          type="date"
          required
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      <label className={LABEL_CLASS}>
        <span className={LABEL_TEXT_CLASS}>ends</span>
        <input
          type="date"
          required
          min={startDate || undefined}
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className={FIELD_CLASS}
        />
      </label>
      {validation ? (
        <p
          id="monthly-focus-validation"
          role="alert"
          className="font-mono text-[12px] text-rose-200 sm:col-span-2"
        >
          {validation}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <p className="text-xs leading-5 text-white/55">
          A movement with no daily goal gets one at this target, so its ring has something to fill.
        </p>
        <button
          type="submit"
          disabled={disabled || exercise === ''}
          className="shrink-0 rounded-full border border-amber-200/30 bg-amber-200/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add focus
        </button>
      </div>
    </form>
  )
}
