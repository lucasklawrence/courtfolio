'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type FormEvent, type JSX } from 'react'

import type {
  ExerciseEquipment,
  ExerciseMuscleGroup,
  WeightRoomExercise,
} from '@/types/weight-room'

/** Props for {@link ExerciseCatalogSettings}. */
export interface ExerciseCatalogSettingsProps {
  /**
   * The full roster as read by the server component on first paint, archived
   * rows included. The editor hydrates from this list; mutations refresh via
   * `router.refresh()` so the next render comes from a fresh server fetch.
   */
  initialExercises: readonly WeightRoomExercise[]
  /**
   * Slugs that currently have a grease-the-groove daily goal. Rendered as a
   * badge so it's obvious which roster entries drive a Today-view ring — and
   * why those can't be deleted even before their sets are considered.
   */
  goalSlugs: readonly string[]
}

/** Selectable equipment kinds, matching the DB check constraint. */
const EQUIPMENT_OPTIONS: readonly ExerciseEquipment[] = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'band',
  'bodyweight',
  'other',
]

/** Selectable muscle groups, matching the DB check constraint. */
const MUSCLE_OPTIONS: readonly ExerciseMuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'full-body',
]

/**
 * The editable half of a catalog row — everything except the immutable slug.
 * Shared by the row editor and the add form so the two can't drift on what a
 * movement carries.
 */
interface ExerciseDraft {
  display_name: string
  equipment: ExerciseEquipment
  muscle_group: ExerciseMuscleGroup
  load_multiplier: number
  is_unilateral: boolean
}

/**
 * Admin-only Weight Room movement-catalog editor (#373).
 *
 * The catalog is the roster every logged set foreign-keys into, so this is
 * where a movement starts existing — a gym lift needs a row here and nothing
 * else, while the separate goal editor above adds a daily ring for the handful
 * of grease-the-groove movements.
 *
 * Deleting is intentionally the narrow path: the FK is `on delete restrict`, so
 * anything with logged history returns 409 and the UI steers to archiving
 * instead. Archived movements stay in the list (dimmed, behind a toggle) so
 * they can be brought back.
 *
 * Mobile-first like its siblings — rows collapse to a summary line and expand
 * into the edit form, which keeps a 30+ movement roster scannable on a phone.
 */
export function ExerciseCatalogSettings({
  initialExercises,
  goalSlugs,
}: ExerciseCatalogSettingsProps): JSX.Element {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [isPending, startTransition] = useTransition()

  const goalSet = useMemo(() => new Set(goalSlugs), [goalSlugs])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return initialExercises.filter((exercise) => {
      if (!showArchived && exercise.archived === true) return false
      if (needle.length === 0) return true
      return (
        exercise.slug.includes(needle) ||
        exercise.display_name.toLowerCase().includes(needle) ||
        exercise.equipment.includes(needle) ||
        exercise.muscle_group.includes(needle)
      )
    })
  }, [initialExercises, query, showArchived])

  const archivedCount = useMemo(
    () => initialExercises.filter((exercise) => exercise.archived === true).length,
    [initialExercises],
  )

  function refresh(): void {
    startTransition(() => {
      router.refresh()
    })
  }

  /** Read `{ error }` off a failed response, falling back to the status code. */
  async function messageFor(res: Response, fallback: string): Promise<string> {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return body.error ?? `${fallback} (${res.status})`
  }

  async function createExercise(slug: string, draft: ExerciseDraft): Promise<boolean> {
    setError(null)
    const res = await fetch('/api/admin/weight-room/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ...draft }),
    })
    if (!res.ok) {
      setError(await messageFor(res, 'Save failed'))
      return false
    }
    refresh()
    return true
  }

  async function patchExercise(
    slug: string,
    patch: Partial<ExerciseDraft> & { archived?: boolean },
  ): Promise<void> {
    setError(null)
    const res = await fetch(`/api/admin/weight-room/exercises/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      setError(await messageFor(res, 'Save failed'))
      return
    }
    refresh()
  }

  async function deleteExercise(slug: string): Promise<void> {
    setError(null)
    const ok = window.confirm(
      `Delete "${slug}" from the catalog? This only works if it has no logged sets, no daily goal, and no monthly focus — otherwise archive it instead.`,
    )
    if (!ok) return
    const res = await fetch(`/api/admin/weight-room/exercises/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      // 409 is the expected answer for anything with history — surface the
      // route's remedy copy rather than treating it as a failure.
      setError(await messageFor(res, 'Delete failed'))
      return
    }
    refresh()
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[12px] text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-1 items-center gap-2 text-xs text-white/70">
          <span className="sr-only">Filter movements</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, equipment, or muscle…"
            autoCapitalize="none"
            className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        {archivedCount > 0 ? (
          <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-4 w-4 accent-amber-300"
            />
            Show archived ({archivedCount})
          </label>
        ) : null}
      </div>

      <section aria-label="Movement catalog">
        {visible.length === 0 ? (
          <p className="text-sm text-[#e8d5be]/70">
            {initialExercises.length === 0
              ? 'No movements yet — add one below to start logging sets.'
              : 'No movements match that filter.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((exercise) => (
              <ExerciseRow
                key={exercise.slug}
                exercise={exercise}
                hasGoal={goalSet.has(exercise.slug)}
                disabled={isPending}
                onPatch={patchExercise}
                onDelete={deleteExercise}
              />
            ))}
          </ul>
        )}
        <p className="mt-3 font-mono text-[11px] text-white/40">
          {visible.length} of {initialExercises.length} movements
        </p>
      </section>

      <section aria-label="Add a movement">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Add movement
        </h3>
        <AddExerciseForm disabled={isPending} onAdd={createExercise} />
      </section>
    </div>
  )
}

interface ExerciseRowProps {
  exercise: WeightRoomExercise
  hasGoal: boolean
  disabled: boolean
  onPatch: (
    slug: string,
    patch: Partial<ExerciseDraft> & { archived?: boolean },
  ) => Promise<void>
  onDelete: (slug: string) => Promise<void>
}

function ExerciseRow({
  exercise,
  hasGoal,
  disabled,
  onPatch,
  onDelete,
}: ExerciseRowProps): JSX.Element {
  const archived = exercise.archived === true
  const [draft, setDraft] = useState<ExerciseDraft>({
    display_name: exercise.display_name,
    equipment: exercise.equipment,
    muscle_group: exercise.muscle_group,
    load_multiplier: exercise.load_multiplier ?? 1,
    is_unilateral: exercise.is_unilateral === true,
  })

  const dirty =
    draft.display_name !== exercise.display_name ||
    draft.equipment !== exercise.equipment ||
    draft.muscle_group !== exercise.muscle_group ||
    draft.load_multiplier !== (exercise.load_multiplier ?? 1) ||
    draft.is_unilateral !== (exercise.is_unilateral === true)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!dirty) return
    await onPatch(exercise.slug, draft)
  }

  return (
    <li
      className={`rounded-[1.1rem] border border-white/10 bg-white/5 ${archived ? 'opacity-50' : ''}`}
    >
      <details>
        <summary className="cursor-pointer list-none px-4 py-3">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-white">{exercise.display_name}</span>
            <span className="font-mono text-[11px] text-white/40">{exercise.slug}</span>
            <span className="ml-auto flex flex-wrap items-center gap-1.5">
              <Chip>{exercise.equipment}</Chip>
              <Chip>{exercise.muscle_group}</Chip>
              {(exercise.load_multiplier ?? 1) > 1 ? (
                <Chip>×{exercise.load_multiplier}</Chip>
              ) : null}
              {exercise.is_unilateral === true ? <Chip>unilateral</Chip> : null}
              {hasGoal ? <Chip accent>daily goal</Chip> : null}
              {archived ? <Chip>archived</Chip> : null}
            </span>
          </span>
        </summary>

        <form onSubmit={handleSubmit} className="grid gap-3 border-t border-white/10 p-4">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            <span className="font-mono uppercase tracking-[0.18em]">display name</span>
            <input
              type="text"
              required
              maxLength={60}
              value={draft.display_name}
              onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
              className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-amber-300/60 focus:outline-none"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-white/70">
              <span className="font-mono uppercase tracking-[0.18em]">equipment</span>
              <select
                value={draft.equipment}
                onChange={(e) =>
                  setDraft({ ...draft, equipment: e.target.value as ExerciseEquipment })
                }
                className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
              >
                {EQUIPMENT_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#120d0a]">
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-white/70">
              <span className="font-mono uppercase tracking-[0.18em]">muscle group</span>
              <select
                value={draft.muscle_group}
                onChange={(e) =>
                  setDraft({ ...draft, muscle_group: e.target.value as ExerciseMuscleGroup })
                }
                className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
              >
                {MUSCLE_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#120d0a]">
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs text-white/70">
              <span className="font-mono uppercase tracking-[0.18em]">implements / set</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.load_multiplier}
                onChange={(e) =>
                  setDraft({ ...draft, load_multiplier: Number(e.target.value) })
                }
                className="w-20 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-xs text-white/70">
              <input
                type="checkbox"
                checked={draft.is_unilateral}
                onChange={(e) => setDraft({ ...draft, is_unilateral: e.target.checked })}
                className="h-4 w-4 accent-amber-300"
              />
              <span className="font-mono uppercase tracking-[0.18em]">unilateral</span>
            </label>
          </div>
          <p className="text-[11px] leading-5 text-white/40">
            Weight is recorded <strong>per implement</strong> — a 60 lb dumbbell shrug is 60
            per hand. Set implements&nbsp;/&nbsp;set to 2 for anything carried as a pair, so
            tonnage counts both.
          </p>

          <div className="flex flex-wrap gap-2">
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
              onClick={() => onPatch(exercise.slug, { archived: !archived })}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDelete(exercise.slug)}
              className="ml-auto rounded-full border border-rose-300/25 bg-rose-300/5 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-rose-200 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </form>
      </details>
    </li>
  )
}

/** Small pill used for the equipment / muscle / status tokens on a row summary. */
function Chip({
  children,
  accent = false,
}: {
  children: React.ReactNode
  accent?: boolean
}): JSX.Element {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
        accent
          ? 'border border-amber-200/30 bg-amber-200/10 text-amber-100'
          : 'border border-white/10 bg-white/5 text-white/50'
      }`}
    >
      {children}
    </span>
  )
}

interface AddExerciseFormProps {
  disabled: boolean
  onAdd: (slug: string, draft: ExerciseDraft) => Promise<boolean>
}

/**
 * Derive a URL-safe slug from a typed display name — lowercase, non-alphanumeric
 * runs collapsed to single hyphens, ends trimmed. `Farmer's Carry` →
 * `farmers-carry`. The API lowercases too, but generating it here means the
 * field can be previewed before saving.
 */
function slugify(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function AddExerciseForm({ disabled, onAdd }: AddExerciseFormProps): JSX.Element {
  const [displayName, setDisplayName] = useState('')
  const [equipment, setEquipment] = useState<ExerciseEquipment>('barbell')
  const [muscleGroup, setMuscleGroup] = useState<ExerciseMuscleGroup>('chest')
  const [loadMultiplier, setLoadMultiplier] = useState(1)
  const [isUnilateral, setIsUnilateral] = useState(false)

  const slug = slugify(displayName)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (slug.length === 0) return
    const created = await onAdd(slug, {
      display_name: displayName.trim(),
      equipment,
      muscle_group: muscleGroup,
      load_multiplier: loadMultiplier,
      is_unilateral: isUnilateral,
    })
    if (!created) return
    setDisplayName('')
    setLoadMultiplier(1)
    setIsUnilateral(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 grid gap-3 rounded-[1.1rem] border border-white/10 bg-white/5 p-4"
    >
      <label className="flex flex-col gap-1 text-xs text-white/70">
        <span className="font-mono uppercase tracking-[0.18em]">movement</span>
        <input
          type="text"
          required
          maxLength={60}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Barbell Bench Press"
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white focus:border-amber-300/60 focus:outline-none"
        />
        <span className="font-mono text-[11px] text-white/40">
          {slug.length > 0 ? `slug: ${slug}` : 'slug generated from the name'}
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">equipment</span>
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as ExerciseEquipment)}
            className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          >
            {EQUIPMENT_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-[#120d0a]">
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">muscle group</span>
          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value as ExerciseMuscleGroup)}
            className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          >
            {MUSCLE_OPTIONS.map((option) => (
              <option key={option} value={option} className="bg-[#120d0a]">
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">implements / set</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={loadMultiplier}
            onChange={(e) => setLoadMultiplier(Number(e.target.value))}
            className="w-20 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-xs text-white/70">
          <input
            type="checkbox"
            checked={isUnilateral}
            onChange={(e) => setIsUnilateral(e.target.checked)}
            className="h-4 w-4 accent-amber-300"
          />
          <span className="font-mono uppercase tracking-[0.18em]">unilateral</span>
        </label>
        <button
          type="submit"
          disabled={disabled || slug.length === 0}
          className="ml-auto rounded-full border border-amber-200/30 bg-amber-200/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </form>
  )
}
