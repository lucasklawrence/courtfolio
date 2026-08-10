import type { JSX } from 'react'

import { formatDayKey } from '@/lib/training-facility/day-keys'
import { slugLabel, type ExerciseLabels } from '@/lib/training-facility/exercise-labels'
import type { LogEra, LogEras } from '@/lib/training-facility/log-eras'

/** Props for {@link EraContrastPanel}. */
export interface EraContrastPanelProps {
  /** The split log. */
  eras: LogEras
  /** Slug → movement name, from `buildExerciseLabels`. */
  exerciseLabels: ExerciseLabels
}

/**
 * The two eras of the log, side by side (#437).
 *
 * Deliberately **not** a diff. The archive is a barbell gym rotation and the
 * current log is mostly bodyweight grease-the-groove, so a subtraction across
 * them would be arithmetic on incompatible things — "volume is down" assembled
 * from barbell tonnage on one side and push-up reps on the other. Each column
 * states what that era was; the reader does the comparing, which is the only
 * honest way to compare training that changed in kind.
 *
 * A Server Component.
 */
export function EraContrastPanel({ eras, exerciseLabels }: EraContrastPanelProps): JSX.Element {
  return (
    <section
      data-testid="era-contrast"
      className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-5"
    >
      <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
        Then and now
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-[#e8d5be]/75">
        Two stretches of training with {formatGap(eras.gapDays)} between them. Read them side by
        side rather than as a difference — they aren’t the same kind of training, so subtracting one
        from the other would produce a number about nothing.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <EraColumn era={eras.then} title="Then" testId="era-then" />
        <EraColumn era={eras.now} title="Now" testId="era-now" />
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#e8d5be]/70">
          What was trained
        </h3>
        <dl className="mt-3 flex flex-col gap-3 text-sm leading-6">
          <RosterRow
            testId="era-roster-shared"
            term={`Both eras · ${eras.roster.shared.length}`}
            slugs={eras.roster.shared}
            labels={exerciseLabels}
            empty="Nothing carried across the layoff."
          />
          <RosterRow
            testId="era-roster-then-only"
            term={`Only then · ${eras.roster.thenOnly.length}`}
            slugs={eras.roster.thenOnly}
            labels={exerciseLabels}
            empty="Everything from the archive is still trained."
          />
          <RosterRow
            testId="era-roster-now-only"
            term={`Only now · ${eras.roster.nowOnly.length}`}
            slugs={eras.roster.nowOnly}
            labels={exerciseLabels}
            empty="Nothing new has been added since."
          />
        </dl>
      </div>
    </section>
  )
}

/** Props for {@link EraColumn}. */
interface EraColumnProps {
  /** The era to describe. */
  era: LogEra
  /** Column heading. */
  title: string
  /** Test id for the column. */
  testId: string
}

/** One era's shape, on its own terms. */
function EraColumn({ era, title, testId }: EraColumnProps): JSX.Element {
  const loadedPct = Math.round(era.loadedShare * 100)
  return (
    <div data-testid={testId} className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300/70">{title}</p>
      <p className="mt-1 font-mono text-[11px] text-[#e8d5be]/60">
        {formatDayKey(era.startDayKey, { month: 'short', year: 'numeric' })} –{' '}
        {formatDayKey(era.endDayKey, { month: 'short', year: 'numeric' })}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[11px]">
        <Stat label="Training days" value={era.trainingDays.toLocaleString()} />
        <Stat label="Movements" value={String(era.movements)} />
        <Stat label="Sets" value={era.sets.toLocaleString()} />
        <Stat label="Reps" value={era.reps.toLocaleString()} />
      </dl>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e8d5be]/60">
          Loaded sets · {loadedPct}%
        </p>
        {/* The change in kind, made visual: the proportion of work that carried
            external weight at all. */}
        <div
          aria-hidden="true"
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/8"
        >
          <div className="h-full bg-amber-300/70" style={{ width: `${loadedPct}%` }} />
        </div>
        <p className="mt-1.5 text-xs leading-5 text-[#e8d5be]/55">
          {era.loadedSets.toLocaleString()} of {era.sets.toLocaleString()} sets carried weight.
        </p>
      </div>
    </div>
  )
}

/** Props for {@link Stat}. */
interface StatProps {
  /** What the number is. */
  label: string
  /** The number, already formatted. */
  value: string
}

/** One labelled figure inside an era column. */
function Stat({ label, value }: StatProps): JSX.Element {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-[#e8d5be]/55">{label}</dt>
      <dd className="text-base font-bold text-[#fff7ec]">{value}</dd>
    </div>
  )
}

/** Props for {@link RosterRow}. */
interface RosterRowProps {
  /** Test id for the row. */
  testId: string
  /** Row heading, including the count. */
  term: string
  /** Movement slugs in this bucket. */
  slugs: readonly string[]
  /** Slug → name lookup. */
  labels: ExerciseLabels
  /** Copy for an empty bucket, which is itself a finding. */
  empty: string
}

/** One bucket of the movement roster, named rather than counted. */
function RosterRow({ testId, term, slugs, labels, empty }: RosterRowProps): JSX.Element {
  return (
    <div data-testid={testId} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#e8d5be]/70">
        {term}
      </dt>
      <dd className="text-[#e8d5be]/80">
        {slugs.length === 0 ? (
          <span className="text-[#e8d5be]/55">{empty}</span>
        ) : (
          slugs.map(slug => slugLabel(slug, undefined, labels)).join(', ')
        )}
      </dd>
    </div>
  )
}

/** A layoff in months where that reads better than days. */
function formatGap(days: number): string {
  if (days < 60) return `${days} days`
  const months = Math.round(days / 30.44)
  return `${months} months`
}
