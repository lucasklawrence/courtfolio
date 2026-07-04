'use client'

import { useEffect, useId, useState, type FormEvent, type JSX } from 'react'

import type { ExerciseGoal } from '@/types/weight-room'

/** Props for {@link QuickLog}. */
export interface QuickLogProps {
  /**
   * Goals to render rows for. The Today View passes the full goal
   * list; this component renders one card per goal so the user can
   * one-tap log against any configured exercise.
   */
  goals: readonly ExerciseGoal[]
  /**
   * Last-logged rep count per exercise — used to seed the "Custom"
   * input with a sensible default. Defaults to {@link DEFAULT_PRESETS}'s
   * middle value when an exercise has no prior log.
   */
  lastReps?: Readonly<Record<string, number | undefined>>
  /**
   * Previously-logged variants per exercise (#254), most-recent first —
   * populates each row's grip datalist so a repeat grip is one pick and
   * a new grip is still typeable. Absent / empty for an exercise renders
   * a plain free-text input with no suggestions.
   */
  variantSuggestions?: Readonly<Record<string, readonly string[] | undefined>>
  /**
   * Async submit handler. Called once per logged set; the parent is
   * expected to POST to `/api/admin/weight-room/sets` and then refetch
   * its data so the rings + set list pick up the new row. Rejects
   * surface as an inline error message; resolves clear the message.
   *
   * `variant` carries the row's optional grip / width / tempo (#254),
   * already trimmed; omitted / empty when the user didn't tag one. The
   * write schema lowercases it, so callers don't need to normalize case.
   */
  onLog: (entry: {
    exercise: string
    reps: number
    variant?: string
  }) => Promise<void>
  /**
   * `false` while a parent action is in flight (e.g. another quick-log
   * still resolving). Disables every button so the form can't submit
   * twice in flight; the parent flips this back when its Promise
   * settles.
   */
  busy?: boolean
}

/**
 * Default rep-count chips. Kept short and weighted toward the
 * common-case "10-ish" so the most frequent action is one tap. The
 * user can always pick "Custom" for a non-standard count.
 */
export const DEFAULT_PRESETS: readonly number[] = [5, 10, 15, 20, 25] as const

/**
 * Curated grip / variant quick-picks per exercise (#254 follow-up),
 * keyed by lowercased exercise name. These pre-populate the QuickLog
 * grip dropdown so the common grips are a one-tap pick and the spelling
 * stays canonical — a curated `chin-up` can't fork into a mistyped
 * `chinup` bucket in the History breakdown. Values are already lowercase
 * to match the write-side normalization ({@link variantWriteField}).
 *
 * Exercises absent here aren't locked out: their dropdown is built from
 * whatever grips they've already been logged with (DB-seen recents),
 * and every exercise always gets the `Custom…` free-text escape for a
 * brand-new grip.
 */
export const GRIP_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  pullups: ['wide', 'close', 'neutral', 'chin-up'],
  pushups: ['standard', 'wide', 'diamond', 'military', 'shoulder'],
}

/**
 * Sentinel `<option>` value for the grip dropdown's "Custom…" choice —
 * selecting it reveals the free-text input. A `__`-fenced string no real
 * lowercased variant can collide with.
 */
const CUSTOM_GRIP = '__custom__'

/**
 * Quick-log control for the Today View (#80). Renders one card per
 * goal with a row of preset chips (`+5 / +10 / …`) and a "Custom"
 * affordance that opens a numeric input. Hits the issue's "2 taps
 * max" target — single tap for the common counts, two taps for an
 * arbitrary value (open custom, type, log).
 *
 * The component is presentational: it doesn't talk to Supabase
 * directly. The parent (TodayView's data island) injects {@link onLog},
 * which is responsible for the POST + refetch. That keeps the
 * component testable without mocking fetch and lets the same UI flow
 * through the demo-fixture path (admin gate stops writes server-side
 * either way).
 */
export function QuickLog({
  goals,
  lastReps = {},
  variantSuggestions = {},
  onLog,
  busy = false,
}: QuickLogProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [pendingExercise, setPendingExercise] = useState<string | null>(null)

  async function handleLog(
    exercise: string,
    reps: number,
    variant?: string,
  ): Promise<void> {
    setError(null)
    setPendingExercise(exercise)
    try {
      // Trim here so the row's raw input state stays untouched but the
      // parent never sees surrounding whitespace; empty → omit so an
      // untagged set logs without a variant.
      const trimmed = variant?.trim()
      await onLog({ exercise, reps, ...(trimmed ? { variant: trimmed } : {}) })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Couldn’t log ${reps} ${exercise}.`,
      )
    } finally {
      setPendingExercise(null)
    }
  }

  return (
    <section
      aria-label="Quick log"
      data-testid="quick-log"
      className="space-y-3"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
          Quick log
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
          One tap · grease the groove
        </span>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[12px] text-rose-200"
        >
          {error}
        </p>
      ) : null}
      <ul className="space-y-3">
        {goals.map((goal) => (
          <QuickLogRow
            key={goal.exercise}
            goal={goal}
            lastReps={lastReps[goal.exercise]}
            variantSuggestions={variantSuggestions[goal.exercise]}
            // Disable every row's chips while any request is in flight,
            // including the row that fired it — without this lock, a
            // second tap on the pending row before the POST returns
            // races into a second concurrent write. The visual ring
            // highlight (`pending`) still distinguishes which row is
            // resolving; the disable is just functional.
            disabled={busy || pendingExercise !== null}
            pending={pendingExercise === goal.exercise}
            onLog={handleLog}
          />
        ))}
      </ul>
    </section>
  )
}

interface QuickLogRowProps {
  goal: ExerciseGoal
  lastReps: number | undefined
  variantSuggestions: readonly string[] | undefined
  disabled: boolean
  pending: boolean
  onLog: (exercise: string, reps: number, variant?: string) => Promise<void>
}

function QuickLogRow({
  goal,
  lastReps,
  variantSuggestions,
  disabled,
  pending,
  onLog,
}: QuickLogRowProps): JSX.Element {
  const customInputId = useId()
  const variantListId = useId()
  const [customOpen, setCustomOpen] = useState<boolean>(false)
  const seedCustom = lastReps ?? DEFAULT_PRESETS[1]
  const [customValue, setCustomValue] = useState<string>(String(seedCustom))
  // The grip/width/tempo attached to the *next* logged set (#254).
  // Deliberately persists across taps within the row so a run of
  // same-grip "grease the groove" sets is one tap each after picking the
  // grip once; the user clears or reselects to switch grips. Empty logs
  // without a variant, keeping the no-variant path a pure one-tap.
  const [variant, setVariant] = useState<string>('')
  // Whether the grip dropdown's "Custom…" free-text input is showing.
  const [gripCustomOpen, setGripCustomOpen] = useState<boolean>(false)

  // Re-seed the Custom input whenever `lastReps` changes (e.g. after a
  // successful preset log + parent refetch). The row stays mounted across
  // logs because it's keyed by exercise, so a one-shot `useState` would
  // otherwise show a stale seed forever. Skip the reset while the form
  // is open so the user's in-progress edits don't get yanked out from
  // under them mid-type.
  useEffect(() => {
    if (!customOpen) setCustomValue(String(seedCustom))
  }, [seedCustom, customOpen])

  // Grip dropdown options: this exercise's curated quick-picks first,
  // then any DB-seen grips not already curated. A unified <select> for
  // every exercise means shrugs (and any new movement) can pick from the
  // grips it's already been logged with — not just free-text — while
  // pull-ups / push-ups lead with their canonical list.
  const recents = variantSuggestions ?? []
  const curated = GRIP_OPTIONS[goal.exercise.toLowerCase()] ?? []
  const gripOptions = [...curated, ...recents.filter((r) => !curated.includes(r))]
  // Reveal the free-text input when Custom… is chosen, or when the
  // current variant isn't a listed option (e.g. a legacy value) so it
  // stays editable instead of being silently dropped by the <select>.
  const variantIsListed = variant === '' || gripOptions.includes(variant)
  const showGripCustom = gripCustomOpen || !variantIsListed
  const gripSelectValue = showGripCustom ? CUSTOM_GRIP : variant

  function handleGripSelect(value: string): void {
    if (value === CUSTOM_GRIP) {
      setGripCustomOpen(true)
    } else {
      setGripCustomOpen(false)
      setVariant(value)
    }
  }

  function clearGrip(): void {
    setGripCustomOpen(false)
    setVariant('')
  }

  async function handlePreset(reps: number): Promise<void> {
    await onLog(goal.exercise, reps, variant)
  }

  async function handleCustomSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const reps = Number(customValue)
    if (!Number.isFinite(reps) || reps <= 0 || !Number.isInteger(reps)) return
    await onLog(goal.exercise, reps, variant)
    setCustomOpen(false)
  }

  return (
    <li
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
      style={{
        boxShadow: pending ? `inset 0 0 0 1px ${goal.color}55` : undefined,
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-mono text-sm font-semibold uppercase tracking-[0.18em]"
          style={{ color: goal.color }}
        >
          {goal.exercise}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
          target {goal.daily_target}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEFAULT_PRESETS.map((reps) => (
          <button
            key={reps}
            type="button"
            disabled={disabled}
            onClick={() => void handlePreset(reps)}
            data-testid={`quick-log-${goal.exercise}-${reps}`}
            className="min-h-[44px] min-w-[64px] rounded-full border border-white/15 bg-black/30 px-4 font-mono text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +{reps}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCustomOpen((v) => !v)}
          aria-expanded={customOpen}
          aria-controls={customInputId}
          className="min-h-[44px] rounded-full border border-white/15 bg-black/30 px-4 font-mono text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Custom
        </button>
      </div>
      {/* Optional grip / width / tempo for the next logged set (#254).
          A dropdown of curated + previously-seen grips, plus a Custom…
          escape that reveals a free-text input (with a recents datalist)
          for a brand-new grip. Persists across taps; "no grip" = untagged
          and keeps the common path a pure one-tap. */}
      <label className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/60">
        <span className="font-mono uppercase tracking-[0.18em]">grip</span>
        <select
          value={gripSelectValue}
          onChange={(e) => handleGripSelect(e.target.value)}
          disabled={disabled}
          aria-label={`Grip for ${goal.exercise} (optional)`}
          data-testid={`quick-log-${goal.exercise}-grip`}
          className="rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          <option value="">no grip</option>
          {gripOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
          <option value={CUSTOM_GRIP}>Custom…</option>
        </select>
        {showGripCustom ? (
          <input
            type="text"
            value={variant}
            list={gripOptions.length > 0 ? variantListId : undefined}
            onChange={(e) => setVariant(e.target.value)}
            disabled={disabled}
            placeholder="type a grip"
            aria-label={`Custom grip for ${goal.exercise}`}
            data-testid={`quick-log-${goal.exercise}-variant`}
            className="w-32 rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-sm text-white placeholder:text-white/30 focus:border-amber-300/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          />
        ) : null}
        {variant.trim() || gripCustomOpen ? (
          <button
            type="button"
            disabled={disabled}
            onClick={clearGrip}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 underline-offset-4 transition hover:text-white/70 disabled:opacity-40"
          >
            clear
          </button>
        ) : null}
        {gripOptions.length > 0 ? (
          <datalist id={variantListId}>
            {gripOptions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        ) : null}
      </label>
      {/* Form stays mounted so the Custom button's `aria-controls` always
          points to a real element. Toggling `hidden` removes it from the
          accessibility tree and the visual layout when closed; auto-focus
          fires only when opening (it's a no-op when the input is hidden). */}
      <form
        id={customInputId}
        onSubmit={handleCustomSubmit}
        hidden={!customOpen}
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <label className="flex items-center gap-2 text-[12px] text-white/70">
          <span className="font-mono uppercase tracking-[0.18em]">reps</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            autoFocus={customOpen}
            className="w-24 rounded border border-white/15 bg-black/40 px-2 py-1.5 text-right font-mono text-sm text-white focus:border-amber-300/60 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || customValue === ''}
          className="min-h-[40px] rounded-full border border-amber-200/30 bg-amber-200/10 px-4 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Log
        </button>
      </form>
    </li>
  )
}
