import type { JSX } from 'react'

import { formatDayKey, safePacificDayKey } from '@/lib/training-facility/day-keys'
import type {
  ExerciseBreakdown,
  SlotAdherence,
  WorkoutAdherence,
  WorkoutComparison,
  WorkoutPersonalBest,
  WorkoutSummary,
} from '@/lib/training-facility/workout-stats'
import type { StrengthSet } from '@/types/weight-room'

/**
 * Format a number of pounds for display — whole pounds, thousands separated.
 * Tonnage runs to five figures, where a decimal is noise.
 */
function lbs(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} lb`
}

/** Format a signed delta, so `+400 lb` and `−120 lb` both read at a glance. */
function signed(value: number, unit: string): string {
  const rounded = Math.round(value)
  if (rounded === 0) return `even`
  const sign = rounded > 0 ? '+' : '−'
  return `${sign}${Math.abs(rounded).toLocaleString('en-US')}${unit === '' ? '' : ` ${unit}`}`
}

/** Duration in `1h 12m` / `48m` form. */
function minutes(value: number): string {
  const whole = Math.round(value)
  if (whole < 60) return `${whole}m`
  return `${Math.floor(whole / 60)}h ${whole % 60}m`
}

/** Render a set as `8 × 60 lb` or `12 reps` when bodyweight. */
function describeSet(reps: number, effectiveLoad: number): string {
  return effectiveLoad > 0 ? `${reps} × ${lbs(effectiveLoad)}` : `${reps} reps`
}

/** Props for {@link WorkoutSummaryPanel}. */
export interface WorkoutSummaryPanelProps {
  /** The session's computed statistics. */
  summary: WorkoutSummary
  /** Prescribed-vs-actual, or `null` for a freestyle session. */
  adherence: WorkoutAdherence | null
  /** Comparison to the previous run of the same template, or `null` when there isn't one. */
  comparison: WorkoutComparison | null
  /** Records set during the session — bests as of that session; empty when none. */
  personalBests: readonly WorkoutPersonalBest[]
  /** Name of the template the session ran, or `null`. */
  templateName: string | null
  /** Label for each slot's prescribed movement, by catalog slug. */
  exerciseLabels: Readonly<Record<string, string>>
}

/**
 * Per-workout summary (#377) — the screen you land on after hitting "end
 * workout", and the click-through target from the workout history.
 *
 * Purely presentational: every number arrives pre-computed from
 * `lib/training-facility/workout-stats.ts`, so this component only formats and
 * lays out. Cream cards on the dark Weight Room surface, matching
 * {@link import('./StrengthStats').StrengthStats}.
 *
 * **Reps lead, tonnage follows.** A pull-ups-and-dips session has a tonnage of
 * zero, and a summary that opened with a big fat `0 lb` would read as a
 * malfunction rather than as an accurate description of bodyweight training —
 * which is the common case here, not an edge case.
 */
export function WorkoutSummaryPanel({
  summary,
  adherence,
  comparison,
  personalBests,
  templateName,
  exerciseLabels,
}: WorkoutSummaryPanelProps): JSX.Element {
  // `totalSets > 0` guard: an empty session also has zero weighted sets, and
  // without it the panel announces "Bodyweight session" directly above the
  // breakdown saying no sets were logged at all. A session ended without
  // logging anything is reachable, so the two must not contradict each other.
  const allBodyweight = summary.totalSets > 0 && summary.weightedSets === 0

  return (
    <div data-testid="workout-summary" className="flex flex-col gap-5">
      <HeadlineStats summary={summary} allBodyweight={allBodyweight} />

      {personalBests.length > 0 ? <PersonalBestStrip bests={personalBests} /> : null}

      {comparison !== null ? (
        <ComparisonCard comparison={comparison} templateName={templateName} />
      ) : templateName !== null ? (
        <p
          data-testid="workout-no-comparison"
          className="rounded-[1.2rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-[#e8d5be]/70"
        >
          First recorded run of <span className="text-[#f7ead9]">{templateName}</span> — nothing to
          compare against yet.
        </p>
      ) : null}

      {adherence !== null && adherence.slots.length > 0 ? (
        <AdherenceCard adherence={adherence} exerciseLabels={exerciseLabels} />
      ) : null}

      {adherence !== null && adherence.extra.length > 0 ? (
        <ExtraWorkCard sets={adherence.extra} exerciseLabels={exerciseLabels} />
      ) : null}

      <BreakdownCard exercises={summary.exercises} allBodyweight={allBodyweight} />
    </div>
  )
}

interface HeadlineStatsProps {
  summary: WorkoutSummary
  allBodyweight: boolean
}

/** The four headline numbers, plus the honest caveats about what they exclude. */
function HeadlineStats({ summary, allBodyweight }: HeadlineStatsProps): JSX.Element {
  const { density } = summary
  return (
    <section
      aria-label="Session totals"
      data-testid="workout-headline"
      className="rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <Stat label="Sets" value={summary.totalSets.toLocaleString('en-US')} />
        <Stat label="Reps" value={summary.totalReps.toLocaleString('en-US')} />
        <Stat
          label="Tonnage"
          value={allBodyweight ? '—' : lbs(summary.tonnage)}
          testId="workout-tonnage"
        />
        <Stat
          label="Duration"
          value={summary.durationMinutes === null ? '—' : minutes(summary.durationMinutes)}
          testId="workout-duration"
        />
      </dl>

      {density !== null ? (
        <p data-testid="workout-density" className="mt-4 text-xs text-[#0a0a0a]/70">
          <span className="font-mono uppercase tracking-[0.16em]">Density</span> ·{' '}
          {density.setsPerMinute >= 0.1
            ? `${density.setsPerMinute.toFixed(2)} sets/min`
            : `${(density.setsPerMinute * 60).toFixed(1)} sets/hr`}
          {allBodyweight
            ? ` · ${density.repsPerMinute.toFixed(1)} reps/min`
            : ` · ${lbs(density.tonnagePerMinute)}/min`}
        </p>
      ) : null}

      {summary.isInProgress ? (
        <p data-testid="workout-in-progress" className="mt-3 text-xs text-[#0a0a0a]/70">
          {summary.isAbandoned
            ? 'This session was never ended, so it has no duration — the totals above are still everything that was logged into it.'
            : 'Session still in progress — these are running totals.'}
        </p>
      ) : null}

      {allBodyweight ? (
        <p data-testid="workout-bodyweight-note" className="mt-3 text-xs text-[#0a0a0a]/70">
          Bodyweight session — no external load, so there&rsquo;s no tonnage to report.
        </p>
      ) : summary.bodyweightSets > 0 ? (
        <p data-testid="workout-bodyweight-note" className="mt-3 text-xs text-[#0a0a0a]/70">
          {summary.bodyweightSets} of {summary.totalSets} sets were bodyweight. They count toward
          reps but not tonnage.
        </p>
      ) : null}
    </section>
  )
}

interface StatProps {
  label: string
  value: string
  testId?: string
}

function Stat({ label, value, testId }: StatProps): JSX.Element {
  return (
    <div data-testid={testId}>
      <dt className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#0a0a0a]/60">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}

interface PersonalBestStripProps {
  bests: readonly WorkoutPersonalBest[]
}

/**
 * Records set in this session — the number that actually drives progression.
 *
 * Phrased as a record set *here* rather than as an all-time best, because that
 * is what it is: the baseline is everything logged before this session, so a
 * later session may since have beaten it. Reading a September summary that
 * insists a lift is your "all-time best" after you have already passed it would
 * be a plain falsehood, and the fact worth surfacing — that this session was a
 * breakthrough — stays true forever.
 */
function PersonalBestStrip({ bests }: PersonalBestStripProps): JSX.Element {
  return (
    <section
      aria-label="Records set in this session"
      data-testid="workout-personal-bests"
      className="rounded-[1.2rem] border border-[#facc15]/40 bg-[#facc15]/10 px-5 py-4"
    >
      <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#facc15]">
        Record{bests.length === 1 ? '' : 's'} set here
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-[#f7ead9]">
        {bests.map(best => (
          <li key={`${best.exercise}-${best.kind}`} data-testid={`workout-pb-${best.exercise}`}>
            <span className="font-semibold">{best.displayName ?? best.exercise}</span>{' '}
            {best.kind === 'load'
              ? describeSet(best.set.reps, best.set.effectiveLoad)
              : `${best.set.reps} reps`}
            <span className="text-[#e8d5be]/60">
              {best.previousBest === null
                ? ' — first time logged'
                : best.kind === 'load'
                  ? ` — past ${lbs(best.previousBest)}`
                  : ` — past ${best.previousBest} reps`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface ComparisonCardProps {
  comparison: WorkoutComparison
  templateName: string | null
}

/** Deltas against the previous run of the same template. */
function ComparisonCard({ comparison, templateName }: ComparisonCardProps): JSX.Element {
  // Pacific day key, not the raw instant — see `formatStart` in
  // WorkoutHistoryList: a UTC server dates a 10pm-Pacific session to the next
  // day, and the two surfaces must name the same day for the same workout.
  const previousKey = safePacificDayKey(comparison.previous.workout.started_at)
  const previousLabel =
    previousKey === ''
      ? 'the previous run'
      : formatDayKey(previousKey, { month: 'short', day: 'numeric' })
  const allBodyweight = comparison.previous.weightedSets === 0 && comparison.tonnageDelta === 0

  return (
    <section
      aria-label="Compared to last time"
      data-testid="workout-comparison"
      className="rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
    >
      <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#0a0a0a]/60">
        vs {templateName === null ? 'last run' : templateName} · {previousLabel}
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="Sets" value={signed(comparison.setsDelta, '')} />
        <Stat label="Reps" value={signed(comparison.repsDelta, '')} />
        {allBodyweight ? null : (
          <Stat label="Tonnage" value={signed(comparison.tonnageDelta, 'lb')} />
        )}
        <Stat
          label="Duration"
          value={comparison.durationDelta === null ? '—' : signed(comparison.durationDelta, 'min')}
        />
      </dl>

      {comparison.exercises.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1 text-xs text-[#0a0a0a]/75">
          {comparison.exercises.map(delta => (
            <li key={delta.exercise} data-testid={`workout-delta-${delta.exercise}`}>
              <span className="font-semibold">{delta.displayName ?? delta.exercise}</span>{' '}
              {delta.isNew ? (
                <span className="text-[#0a0a0a]/60">— not in the previous run</span>
              ) : (
                <>
                  {signed(delta.repsDelta, 'reps')}
                  {delta.topSetLoadDelta !== null
                    ? ` · top set ${signed(delta.topSetLoadDelta, 'lb')}`
                    : ''}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

interface AdherenceCardProps {
  adherence: WorkoutAdherence
  exerciseLabels: Readonly<Record<string, string>>
}

/**
 * Prescribed vs actual, per slot.
 *
 * A substitution is rendered as a substitution — an equal outcome, phrased
 * neutrally — and counts as completed. The rack being taken is not a failure to
 * train, and a summary that scored it as a miss would be teaching the wrong
 * lesson every time it happened.
 */
function AdherenceCard({ adherence, exerciseLabels }: AdherenceCardProps): JSX.Element {
  const pct = Math.round(adherence.completion * 100)
  return (
    <section
      aria-label="Prescribed vs actual"
      data-testid="workout-adherence"
      className="rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#0a0a0a]/60">
          Prescribed vs actual
        </h3>
        <p className="text-sm font-bold tabular-nums" data-testid="workout-completion">
          {pct}%
          <span className="ml-1.5 font-normal text-[#0a0a0a]/60">
            ({adherence.completedSets}/{adherence.prescribedSets} sets)
          </span>
        </p>
      </header>

      <ul className="mt-3 flex flex-col divide-y divide-black/10">
        {adherence.slots.map(slot => (
          <SlotRow key={slot.slot.id} slot={slot} exerciseLabels={exerciseLabels} />
        ))}
      </ul>

      {adherence.substitutedSlots > 0 ? (
        <p className="mt-3 text-xs text-[#0a0a0a]/70">
          {adherence.substitutedSlots} movement{adherence.substitutedSlots === 1 ? '' : 's'}{' '}
          substituted — counted as completed.
        </p>
      ) : null}
    </section>
  )
}

interface SlotRowProps {
  slot: SlotAdherence
  exerciseLabels: Readonly<Record<string, string>>
}

function SlotRow({ slot, exerciseLabels }: SlotRowProps): JSX.Element {
  const label = (slug: string): string => exerciseLabels[slug] ?? slug
  const prescribedSets =
    slot.slot.target_sets_max === undefined
      ? `${slot.slot.target_sets}`
      : `${slot.slot.target_sets}–${slot.slot.target_sets_max}`
  const prescribedReps =
    slot.slot.target_reps === undefined
      ? 'AMRAP'
      : slot.slot.target_reps_max === undefined
        ? `${slot.slot.target_reps}`
        : `${slot.slot.target_reps}–${slot.slot.target_reps_max}`

  return (
    <li
      data-testid={`workout-slot-${slot.slot.id}`}
      data-complete={slot.isComplete}
      data-substituted={slot.isSubstituted}
      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {label(slot.performedExercise)}
          {slot.isSubstituted ? (
            <span className="ml-1.5 rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[#0a0a0a]/70">
              swapped from {label(slot.slot.exercise)}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-[#0a0a0a]/60">
          prescribed {prescribedSets} × {prescribedReps}
          {slot.slot.target_weight_lbs !== undefined ? ` @ ${slot.slot.target_weight_lbs} lb` : ''}
        </p>
      </div>
      <p className="shrink-0 text-sm tabular-nums">
        <span className={slot.isComplete ? 'font-bold' : 'font-bold text-[#b45309]'}>
          {slot.logged}
        </span>
        <span className="text-[#0a0a0a]/50"> / {slot.slot.target_sets} sets</span>
      </p>
    </li>
  )
}

interface ExtraWorkCardProps {
  sets: readonly StrengthSet[]
  exerciseLabels: Readonly<Record<string, string>>
}

/** Sets logged into the session that no slot prescribed. */
function ExtraWorkCard({ sets, exerciseLabels }: ExtraWorkCardProps): JSX.Element {
  const byExercise = new Map<string, StrengthSet[]>()
  for (const set of sets) {
    const list = byExercise.get(set.exercise)
    if (list) list.push(set)
    else byExercise.set(set.exercise, [set])
  }

  return (
    <section
      aria-label="Extra work"
      data-testid="workout-extra-work"
      className="rounded-[1.2rem] border border-white/10 bg-white/5 px-5 py-4"
    >
      <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#e8d5be]/80">
        Extra work
      </h3>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-[#f7ead9]">
        {[...byExercise.entries()].map(([exercise, exSets]) => (
          <li key={exercise} data-testid={`workout-extra-${exercise}`}>
            <span className="font-semibold">{exerciseLabels[exercise] ?? exercise}</span>{' '}
            <span className="text-[#e8d5be]/70">
              {exSets.length} set{exSets.length === 1 ? '' : 's'} ·{' '}
              {exSets.reduce((total, s) => total + s.reps, 0)} reps
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface BreakdownCardProps {
  exercises: readonly ExerciseBreakdown[]
  allBodyweight: boolean
}

/** Per-movement breakdown: sets, reps, tonnage, top set, estimated 1RM. */
function BreakdownCard({ exercises, allBodyweight }: BreakdownCardProps): JSX.Element {
  if (exercises.length === 0) {
    return (
      <p
        data-testid="workout-breakdown-empty"
        className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
      >
        No sets logged into this session.
      </p>
    )
  }

  return (
    <section
      aria-label="Per-exercise breakdown"
      data-testid="workout-breakdown"
      className="overflow-x-auto rounded-[1.2rem] border border-white/10 bg-[#f5f1e6] text-[#0a0a0a] shadow-[0_12px_32px_rgba(0,0,0,0.28)]"
    >
      <table className="w-full min-w-[30rem] border-collapse text-sm">
        <caption className="px-5 pt-5 text-left font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#0a0a0a]/60">
          Per exercise
        </caption>
        <thead>
          <tr className="border-b border-black/10 text-left font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[#0a0a0a]/55">
            <th scope="col" className="px-5 py-2.5 font-normal">
              Movement
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-normal">
              Sets
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-normal">
              Reps
            </th>
            {allBodyweight ? null : (
              <th scope="col" className="px-3 py-2.5 text-right font-normal">
                Tonnage
              </th>
            )}
            <th scope="col" className="px-5 py-2.5 text-right font-normal">
              Top set
            </th>
          </tr>
        </thead>
        <tbody>
          {exercises.map(entry => (
            <tr
              key={entry.exercise}
              data-testid={`workout-breakdown-${entry.exercise}`}
              className="border-b border-black/5 last:border-0"
            >
              <th scope="row" className="px-5 py-2.5 text-left font-semibold">
                {entry.displayName ?? entry.exercise}
              </th>
              <td className="px-3 py-2.5 text-right tabular-nums">{entry.sets}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{entry.reps}</td>
              {allBodyweight ? null : (
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {entry.isBodyweight ? '—' : lbs(entry.tonnage)}
                </td>
              )}
              <td className="px-5 py-2.5 text-right tabular-nums">
                {entry.topSet === null
                  ? `${entry.bestRepSet.reps} reps`
                  : describeSet(entry.topSet.reps, entry.topSet.effectiveLoad)}
                {entry.estimatedOneRepMax !== null ? (
                  <span
                    className="block text-[0.7rem] text-[#0a0a0a]/55"
                    title={
                      entry.oneRepMaxIsReliable
                        ? 'Epley estimate from the top set'
                        : 'Epley estimate from a high-rep set — treat as a gesture, not a measurement'
                    }
                  >
                    ~{lbs(entry.estimatedOneRepMax)} est. 1RM
                    {entry.oneRepMaxIsReliable ? '' : ' ?'}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
