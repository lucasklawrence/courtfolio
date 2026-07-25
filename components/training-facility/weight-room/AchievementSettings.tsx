'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type FormEvent, type JSX } from 'react'

import { SCOPE_LABELS, POOLED_LABEL } from '@/lib/training-facility/achievements'
import type {
  AchievementMeasure,
  AchievementScope,
  WeightRoomAchievement,
} from '@/types/weight-room'

/** Props for {@link AchievementSettings}. */
export interface AchievementSettingsProps {
  /**
   * The ladder as read by the server component on first paint. The editor
   * hydrates from this list; mutations refresh via `router.refresh()` so the
   * next render comes from a fresh server fetch (no client cache to invalidate).
   */
  initialAchievements: readonly WeightRoomAchievement[]
  /**
   * Configured exercise names, offered in the exercise dropdown alongside the
   * pooled "all movements" option. A tier may reference an exercise that no
   * longer has a goal (achievements are deliberately not foreign-keyed), so the
   * dropdown unions these with whatever the existing tiers already use.
   */
  exercises: readonly string[]
}

/** Scope options in the same order the Trophy Room renders them. */
const SCOPES: readonly AchievementScope[] = ['day', 'week', 'month', 'streak', 'lifetime', 'set']

/** Measure options, with the wording used on the wall. */
const MEASURES: readonly { value: AchievementMeasure; label: string }[] = [
  { value: 'reps', label: 'Reps' },
  { value: 'tonnage', label: 'Weight moved' },
  { value: 'load', label: 'Set load' },
]

/** Accent applied to a new tier's color picker before the admin changes it — banner yellow. */
const DEFAULT_NEW_COLOR = '#FACC15'

/** Sentinel `<option>` value standing in for `exercise: null` (the pooled ladder). */
const POOLED_OPTION = '__pooled__'

/** The write payload shared by create and update. */
interface AchievementBody {
  label: string
  exercise: string | null
  scope: AchievementScope
  measure: AchievementMeasure
  threshold: number
  color: string
  icon?: string
}

/**
 * Admin-only editor for the Weight Room achievement ladder (#336). Renders each
 * existing tier as an editable row and a small form to add a new one. Each
 * mutation hits the admin API routes under `/api/admin/weight-room/achievements`;
 * on success the parent page's server data refreshes via `router.refresh()` so
 * the ladder re-reads without a manual reload.
 *
 * Mirrors the `OtfMileageAwardsSettings` editor, with the extra exercise + scope
 * selectors this ladder needs — a threshold is meaningless without knowing which
 * metric it measures.
 */
export function AchievementSettings({
  initialAchievements,
  exercises,
}: AchievementSettingsProps): JSX.Element {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Union the configured goals with any exercise an existing tier already
  // references, so editing a tier for a since-deleted movement doesn't silently
  // re-point it at something else.
  const exerciseOptions = useMemo(() => {
    const names = new Set<string>(exercises)
    for (const a of initialAchievements) {
      if (a.exercise !== null) names.add(a.exercise)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [exercises, initialAchievements])

  function refresh(): void {
    startTransition(() => {
      router.refresh()
    })
  }

  async function createAchievement(body: AchievementBody): Promise<boolean> {
    setError(null)
    const res = await fetch('/api/admin/weight-room/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      setError(payload.error ?? `Save failed (${res.status})`)
      return false
    }
    refresh()
    return true
  }

  async function updateAchievement(id: string, body: AchievementBody): Promise<void> {
    setError(null)
    const res = await fetch(`/api/admin/weight-room/achievements/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      setError(payload.error ?? `Save failed (${res.status})`)
      return
    }
    refresh()
  }

  async function deleteAchievement(achievement: WeightRoomAchievement): Promise<void> {
    setError(null)
    const ok = window.confirm(`Delete the "${achievement.label}" achievement?`)
    if (!ok) return
    const res = await fetch(
      `/api/admin/weight-room/achievements/${encodeURIComponent(achievement.id)}`,
      { method: 'DELETE' },
    )
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      setError(payload.error ?? `Delete failed (${res.status})`)
      return
    }
    refresh()
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

      <section aria-label="Existing achievements">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Achievements
        </h2>
        {initialAchievements.length === 0 ? (
          <p className="mt-3 text-sm text-[#e8d5be]/70">
            No achievements yet — add one below to start hanging banners.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {initialAchievements.map((achievement) => (
              <AchievementRow
                key={achievement.id}
                achievement={achievement}
                exerciseOptions={exerciseOptions}
                disabled={isPending}
                onSave={updateAchievement}
                onDelete={deleteAchievement}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Add an achievement">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Add achievement
        </h2>
        <AddAchievementForm
          exerciseOptions={exerciseOptions}
          disabled={isPending}
          onAdd={createAchievement}
        />
      </section>
    </div>
  )
}

/** Shared Tailwind for the editor's text/number inputs and selects. */
const FIELD_CLASS =
  'rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none'

/** Props for one editable achievement row. */
interface AchievementRowProps {
  achievement: WeightRoomAchievement
  exerciseOptions: readonly string[]
  disabled: boolean
  onSave: (id: string, body: AchievementBody) => Promise<void>
  onDelete: (achievement: WeightRoomAchievement) => Promise<void>
}

/** One existing tier as an inline-editable form row. */
function AchievementRow({
  achievement,
  exerciseOptions,
  disabled,
  onSave,
  onDelete,
}: AchievementRowProps): JSX.Element {
  const [label, setLabel] = useState<string>(achievement.label)
  const [exercise, setExercise] = useState<string>(achievement.exercise ?? POOLED_OPTION)
  const [scope, setScope] = useState<AchievementScope>(achievement.scope)
  const [measure, setMeasure] = useState<AchievementMeasure>(achievement.measure ?? 'reps')
  const [threshold, setThreshold] = useState<number>(achievement.threshold)
  const [color, setColor] = useState<string>(achievement.color ?? DEFAULT_NEW_COLOR)
  const [icon, setIcon] = useState<string>(achievement.icon ?? '')

  const dirty =
    label !== achievement.label ||
    exercise !== (achievement.exercise ?? POOLED_OPTION) ||
    scope !== achievement.scope ||
    measure !== (achievement.measure ?? 'reps') ||
    threshold !== achievement.threshold ||
    color !== (achievement.color ?? DEFAULT_NEW_COLOR) ||
    icon !== (achievement.icon ?? '')

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmedLabel = label.trim()
    const trimmedIcon = icon.trim()
    if (!dirty || trimmedLabel.length === 0 || !Number.isInteger(threshold) || threshold <= 0) return
    await onSave(achievement.id, {
      label: trimmedLabel,
      exercise: exercise === POOLED_OPTION ? null : exercise,
      scope,
      measure,
      threshold,
      color,
      ...(trimmedIcon === '' ? {} : { icon: trimmedIcon }),
    })
  }

  return (
    <li className="rounded-[1.1rem] border border-white/10 bg-white/5 p-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <Field label="name">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={`${FIELD_CLASS} w-40`}
          />
        </Field>
        <Field label="movement">
          <ExerciseSelect value={exercise} options={exerciseOptions} onChange={setExercise} />
        </Field>
        <Field label="window">
          <ScopeSelect value={scope} onChange={setScope} />
        </Field>
        <Field label="counts">
          <MeasureSelect value={measure} onChange={setMeasure} />
        </Field>
        <Field label={thresholdUnit(scope, measure)}>
          <input
            type="number"
            min={1}
            step={1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className={`${FIELD_CLASS} w-24 text-right`}
          />
        </Field>
        <Field label="icon">
          <input
            type="text"
            value={icon}
            maxLength={8}
            placeholder="💯"
            onChange={(e) => setIcon(e.target.value)}
            className={`${FIELD_CLASS} w-16 text-center`}
          />
        </Field>
        <Field label="color">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-white/15 bg-black/40"
          />
        </Field>
        <div className="ml-auto flex gap-2">
          <button
            type="submit"
            disabled={disabled || !dirty}
            className="rounded-full border border-amber-200/30 bg-amber-200/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(achievement)}
            className="rounded-full border border-rose-300/25 bg-rose-300/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </form>
    </li>
  )
}

/** Props for the add-achievement form. */
interface AddAchievementFormProps {
  exerciseOptions: readonly string[]
  disabled: boolean
  onAdd: (body: AchievementBody) => Promise<boolean>
}

/** Small form to append a new tier; clears itself on a successful add. */
function AddAchievementForm({
  exerciseOptions,
  disabled,
  onAdd,
}: AddAchievementFormProps): JSX.Element {
  const [label, setLabel] = useState<string>('')
  const [exercise, setExercise] = useState<string>(exerciseOptions[0] ?? POOLED_OPTION)
  const [scope, setScope] = useState<AchievementScope>('day')
  const [measure, setMeasure] = useState<AchievementMeasure>('reps')
  const [threshold, setThreshold] = useState<number>(100)
  const [color, setColor] = useState<string>(DEFAULT_NEW_COLOR)
  const [icon, setIcon] = useState<string>('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmedLabel = label.trim()
    const trimmedIcon = icon.trim()
    if (trimmedLabel.length === 0 || !Number.isInteger(threshold) || threshold <= 0) return
    const ok = await onAdd({
      label: trimmedLabel,
      exercise: exercise === POOLED_OPTION ? null : exercise,
      scope,
      measure,
      threshold,
      color,
      ...(trimmedIcon === '' ? {} : { icon: trimmedIcon }),
    })
    if (!ok) return
    setLabel('')
    setIcon('')
    setColor(DEFAULT_NEW_COLOR)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-wrap items-end gap-3 rounded-[1.1rem] border border-white/10 bg-white/5 p-4"
    >
      <Field label="name">
        <input
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Century Club"
          className={`${FIELD_CLASS} w-40`}
        />
      </Field>
      <Field label="movement">
        <ExerciseSelect value={exercise} options={exerciseOptions} onChange={setExercise} />
      </Field>
      <Field label="window">
        <ScopeSelect value={scope} onChange={setScope} />
      </Field>
      <Field label="counts">
        <MeasureSelect value={measure} onChange={setMeasure} />
      </Field>
      <Field label={thresholdUnit(scope, measure)}>
        <input
          type="number"
          min={1}
          step={1}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className={`${FIELD_CLASS} w-24 text-right`}
        />
      </Field>
      <Field label="icon">
        <input
          type="text"
          value={icon}
          maxLength={8}
          placeholder="💯"
          onChange={(e) => setIcon(e.target.value)}
          className={`${FIELD_CLASS} w-16 text-center`}
        />
      </Field>
      <Field label="color">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-16 cursor-pointer rounded border border-white/15 bg-black/40"
        />
      </Field>
      <button
        type="submit"
        disabled={disabled || label.trim().length === 0}
        className="ml-auto rounded-full border border-amber-200/30 bg-amber-200/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}

/** A labeled form control — the `<label>` wrapper both forms share. */
function Field({ label, children }: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-white/70">
      <span className="font-mono uppercase tracking-[0.18em]">{label}</span>
      {children}
    </label>
  )
}

/** Movement dropdown — the configured exercises plus the pooled "all movements" option. */
function ExerciseSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: readonly string[]
  onChange: (next: string) => void
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD_CLASS} w-36`}
    >
      <option value={POOLED_OPTION}>{POOLED_LABEL}</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  )
}

/**
 * Unit label for the threshold input, so the admin can see at a glance whether
 * they're typing reps, pounds, or days. Mirrors the resolver's rule that a
 * streak always counts days regardless of measure.
 */
function thresholdUnit(scope: AchievementScope, measure: AchievementMeasure): string {
  if (scope === 'streak') return 'days'
  return measure === 'reps' ? 'reps' : 'lb'
}

/** Measure dropdown — what the threshold counts within the chosen window. */
function MeasureSelect({
  value,
  onChange,
}: {
  value: AchievementMeasure
  onChange: (next: AchievementMeasure) => void
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AchievementMeasure)}
      className={`${FIELD_CLASS} w-32`}
    >
      {MEASURES.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  )
}

/** Scope dropdown, labeled with the same wording the Trophy Room uses. */
function ScopeSelect({
  value,
  onChange,
}: {
  value: AchievementScope
  onChange: (next: AchievementScope) => void
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AchievementScope)}
      className={`${FIELD_CLASS} w-32`}
    >
      {SCOPES.map((scope) => (
        <option key={scope} value={scope}>
          {SCOPE_LABELS[scope]}
        </option>
      ))}
    </select>
  )
}
