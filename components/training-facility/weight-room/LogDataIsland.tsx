'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'

import { getWeightRoomData } from '@/lib/data/weight-room'
import {
  activeFocusForDay,
  computeFocusAdherence,
  computeFocusLoadStats,
  upcomingFocuses,
} from '@/lib/training-facility/monthly-focus'
import { computeStrengthStreaks } from '@/lib/training-facility/strength-streaks'
import {
  filterSetsForDay,
  formatDayLabel,
  localNoonIsoForDay,
  toLocalDateKey,
  totalsByExercise,
} from '@/lib/training-facility/strength-today'
import type { MonthlyFocus, StrengthSet, WeightRoomData } from '@/types/weight-room'

import { ActivityRings, type RingProgress } from './ActivityRings'
import { LogDayPicker } from './LogDayPicker'
import { MonthlyFocusCard } from './MonthlyFocusCard'
import { QuickLog } from './QuickLog'
import { SetList } from './SetList'
import { StreakBadge } from './StreakBadge'
import { UpcomingFocusStrip } from './UpcomingFocusStrip'

/**
 * Admin Log View data island (#197). Owns the strength dataset that
 * powers the dashboard-style admin page at
 * `/training-facility/weight-room/log` — activity rings, streak
 * badges, the QuickLog form, and the selected day's SetList live here
 * behind a single `getWeightRoomData()` read.
 *
 * The view is day-addressable (#202): a {@link LogDayPicker} above the
 * grid defaults to today, and selecting a past day flips rings, totals,
 * and the set list to that day while stamping newly logged sets onto it
 * (local noon, via `logged_at`). Streak badges always show the all-time
 * computation regardless of the selected day.
 *
 * Always renders the admin-only surfaces (quick-log form + set-list
 * delete buttons) because the parent page is already admin-gated by
 * `requireAdminPage()`. No empty-state preview branch — admins log
 * real sets, not a demo fixture.
 *
 * Mirrors the write orchestration the previous Today-view island used:
 * busy flag lifts up to disable delete + log in flight, and a
 * monotonic request id keeps a slow mount fetch from clobbering fresh
 * post-write data.
 */
export function LogDataIsland(): JSX.Element {
  const [data, setData] = useState<WeightRoomData | null | undefined>(undefined)
  // `loadError` is the "fetch threw" branch, distinct from `data === null`
  // (the "tables are genuinely empty" branch). Splitting them keeps a
  // transient Supabase blip from masquerading as "no data yet."
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  // Day the whole view is pointed at (#202) — rings, totals, SetList,
  // and the `logged_at` of newly logged sets all follow this key. Lazy
  // initializer so "today" is computed once at mount, not every render.
  const [selectedDay, setSelectedDay] = useState<string>(() =>
    toLocalDateKey(new Date()),
  )
  const requestIdRef = useRef(0)

  useEffect(() => {
    const id = ++requestIdRef.current
    getWeightRoomData()
      .then((d) => {
        if (id === requestIdRef.current) {
          setData(d)
          setLoadError(null)
        }
      })
      .catch((err: unknown) => {
        if (id === requestIdRef.current) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load.')
          setData((prev) => (prev === undefined ? null : prev))
        }
      })
    return () => {
      requestIdRef.current += 1
    }
  }, [])

  const refetch = useCallback(async (): Promise<void> => {
    const id = ++requestIdRef.current
    try {
      const d = await getWeightRoomData()
      if (id === requestIdRef.current) {
        setData(d)
        setLoadError(null)
      }
    } catch (err: unknown) {
      if (id === requestIdRef.current) {
        setLoadError(err instanceof Error ? err.message : 'Refresh failed.')
      }
    }
  }, [])

  const lastReps = useMemo(
    () => (data ? computeLastRepsByExercise(data.sets) : {}),
    [data],
  )

  if (data === undefined) {
    return (
      <div
        className="rounded-[1.6rem] border border-white/10 bg-black/30 p-10 text-center text-sm text-white/55"
        data-testid="log-loading"
      >
        Loading today’s sets…
      </div>
    )
  }

  // `data === null` here means the tables are genuinely empty (or a
  // mount-fetch failure that settled the state to null). Either way,
  // surface the form so the admin can add their first set; the rings
  // render in their empty state.
  const surfaceData: WeightRoomData = data ?? {
    goals: [],
    sets: [],
    imported_at: '',
    monthly_focus: [],
  }
  const todayKey = toLocalDateKey(new Date())
  // Display-only backfill flag. After a midnight rollover `selectedDay`
  // (set at mount) lags `todayKey` — that's intentional: the view stays
  // on the day the admin was logging against, now flagged as a backfill
  // by the picker. The *write* path recomputes this at tap time inside
  // onLog so a stale render closure can't stamp the wrong day.
  const isBackfilling = selectedDay !== todayKey
  const setsForDay = filterSetsForDay(surfaceData.sets, selectedDay)
  const totals = totalsByExercise(setsForDay)

  // The focus active on the *viewed* day (#255). A `kind: 'focus'` goal
  // only earns a ring / streak / quick-log button while its window
  // covers the day, so a finished or future focus doesn't leave a stale
  // empty ring. Permanent goals always show.
  const activeFocus = activeFocusForDay(surfaceData.monthly_focus, selectedDay)
  const visibleGoals = surfaceData.goals.filter(
    (goal) => goal.kind !== 'focus' || goal.exercise === activeFocus?.exercise,
  )
  const upcoming = upcomingFocuses(surfaceData.monthly_focus, todayKey)

  const rings: RingProgress[] = visibleGoals.map((goal) => ({
    goal,
    totalReps: totals.get(goal.exercise) ?? 0,
  }))
  const streaks = computeStrengthStreaks(surfaceData.sets, visibleGoals)
  // SetList color/label lookup spans *all* goals (incl. inactive focuses)
  // so a backfilled out-of-window set still resolves its exercise.
  const goalsByExercise = Object.fromEntries(
    surfaceData.goals.map((g) => [g.exercise, g]),
  )

  // Focus card inputs: today's progress in the focus's own unit (reps or
  // distinct sets), plus windowed adherence and load stats.
  const focusCard = activeFocus
    ? buildFocusCardProps(activeFocus, setsForDay, surfaceData.sets)
    : null

  return (
    <div className="flex flex-col gap-8">
      {loadError ? <LoadErrorBanner message={loadError} /> : null}

      <LogDayPicker
        selectedDay={selectedDay}
        todayKey={todayKey}
        onSelectDay={setSelectedDay}
      />

      <UpcomingFocusStrip focuses={upcoming} />

      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
        <div className="flex w-full max-w-[264px] flex-col items-center gap-4">
          <ActivityRings rings={rings} size={264} className="w-full max-w-[264px]" />
          <div className="grid w-full gap-2">
            {visibleGoals.map((goal) => (
              <StreakBadge
                key={goal.exercise}
                exercise={goal.exercise}
                streak={streaks[goal.exercise] ?? { current: 0, longest: 0 }}
                accentColor={goal.color}
              />
            ))}
          </div>
          {focusCard ? (
            <MonthlyFocusCard
              focus={focusCard.focus}
              todayProgress={focusCard.todayProgress}
              adherence={focusCard.adherence}
              loadStats={focusCard.loadStats}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          {visibleGoals.length > 0 ? (
            <QuickLog
              goals={visibleGoals}
              lastReps={lastReps}
              onLog={({ exercise, reps }) => {
                // Recompute "today" at tap time rather than reusing the
                // render-scoped isBackfilling — a page left mounted across
                // local midnight would otherwise have a stale closure and
                // silently stamp the set with the new day's now() while
                // the view still shows the previous day (Codex P2 on
                // #228). Backfills stamp local noon of the selected day;
                // same-day logs omit logged_at so the API keeps its now()
                // default (real time-of-day on the set row). `|| undefined`
                // guards the '' unparseable-key fallback.
                const isBackfillAtTap = selectedDay !== toLocalDateKey(new Date())
                return logSet(
                  exercise,
                  reps,
                  isBackfillAtTap
                    ? localNoonIsoForDay(selectedDay) || undefined
                    : undefined,
                  setBusy,
                  refetch,
                )
              }}
              busy={busy}
            />
          ) : (
            <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/65">
              No goals configured yet —{' '}
              <a
                href="/training-facility/weight-room/settings"
                className="text-amber-200 underline-offset-4 hover:underline"
              >
                add one in Settings
              </a>{' '}
              before logging sets.
            </p>
          )}
          <SetList
            setsToday={setsForDay}
            goalsByExercise={goalsByExercise}
            onDelete={(s) => deleteSet(s, setBusy, refetch)}
            busy={busy}
            dayLabel={isBackfilling ? formatDayLabel(selectedDay) || selectedDay : 'Today'}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * POST a new strength set, then refetch so rings + list reflect on-disk truth.
 *
 * @param loggedAt Optional ISO timestamp for backdated sets (#202).
 *   Omitted for same-day logs so the API's `now()` default stamps the
 *   real time-of-day.
 */
async function logSet(
  exercise: string,
  reps: number,
  loggedAt: string | undefined,
  setBusy: (v: boolean) => void,
  refetch: () => Promise<void>,
): Promise<void> {
  setBusy(true)
  try {
    const res = await fetch('/api/admin/weight-room/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        loggedAt ? { exercise, reps, logged_at: loggedAt } : { exercise, reps },
      ),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? `Save failed (${res.status})`)
    }
    await refetch()
  } finally {
    setBusy(false)
  }
}

/**
 * Drop one logged set via the admin DELETE endpoint, then refetch so
 * the rings + list reflect on-disk truth. Confirms with the user first
 * because the action isn't undoable client-side and undoing it
 * requires re-logging the set.
 */
async function deleteSet(
  set: StrengthSet,
  setBusy: (v: boolean) => void,
  refetch: () => Promise<void>,
): Promise<void> {
  const ok = window.confirm(`Delete this set of ${set.reps} ${set.exercise}?`)
  if (!ok) return
  setBusy(true)
  try {
    const res = await fetch(`/api/admin/weight-room/sets/${set.id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? `Delete failed (${res.status})`)
    }
    await refetch()
  } finally {
    setBusy(false)
  }
}

/**
 * Per-exercise last-logged rep count, used to seed the QuickLog
 * "Custom" input. Walks the full `sets` array (not just today's) so
 * the seed survives a midnight rollover.
 */
function computeLastRepsByExercise(
  sets: readonly StrengthSet[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sets) {
    out[s.exercise] = s.reps
  }
  return out
}

/**
 * Assemble {@link MonthlyFocusCard} inputs for the active focus: today's
 * progress in the focus's own unit (total reps, or distinct-set count
 * for a `sets` target), plus windowed adherence and load stats computed
 * over the full set history.
 *
 * @param focus The focus active on the viewed day.
 * @param setsForDay Sets already filtered to the viewed day.
 * @param allSets The full set log, for window-spanning adherence + load.
 */
function buildFocusCardProps(
  focus: MonthlyFocus,
  setsForDay: readonly StrengthSet[],
  allSets: readonly StrengthSet[],
): {
  focus: MonthlyFocus
  todayProgress: number
  adherence: ReturnType<typeof computeFocusAdherence>
  loadStats: ReturnType<typeof computeFocusLoadStats>
} {
  const focusSetsToday = setsForDay.filter((s) => s.exercise === focus.exercise)
  const todayProgress =
    focus.target_kind === 'sets'
      ? focusSetsToday.length
      : focusSetsToday.reduce((n, s) => n + s.reps, 0)
  return {
    focus,
    todayProgress,
    adherence: computeFocusAdherence(focus, allSets),
    loadStats: computeFocusLoadStats(focus, allSets),
  }
}

function LoadErrorBanner({ message }: { message: string }): JSX.Element {
  return (
    <p
      role="alert"
      data-testid="log-load-error"
      className="rounded-2xl border border-rose-400/30 bg-rose-950/40 px-4 py-3 font-mono text-[12px] text-rose-200"
    >
      {message}
    </p>
  )
}
