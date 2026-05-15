'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'

import { getWeightRoomData } from '@/lib/data/weight-room'
import { computeStrengthStreaks } from '@/lib/training-facility/strength-streaks'
import {
  filterSetsForDay,
  toLocalDateKey,
  totalsByExercise,
} from '@/lib/training-facility/strength-today'
import type { StrengthSet, WeightRoomData } from '@/types/weight-room'

import { ActivityRings, type RingProgress } from './ActivityRings'
import { QuickLog } from './QuickLog'
import { SetList } from './SetList'
import { StreakBadge } from './StreakBadge'

/**
 * Admin Log View data island (#197). Owns the strength dataset that
 * powers the dashboard-style admin page at
 * `/training-facility/weight-room/log` — activity rings, streak
 * badges, the QuickLog form, and today's SetList live here behind a
 * single `getWeightRoomData()` read.
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
  const surfaceData: WeightRoomData = data ?? { goals: [], sets: [], imported_at: '' }
  const todayKey = toLocalDateKey(new Date())
  const setsToday = filterSetsForDay(surfaceData.sets, todayKey)
  const totals = totalsByExercise(setsToday)
  const rings: RingProgress[] = surfaceData.goals.map((goal) => ({
    goal,
    totalReps: totals.get(goal.exercise) ?? 0,
  }))
  const streaks = computeStrengthStreaks(surfaceData.sets, surfaceData.goals)
  const goalsByExercise = Object.fromEntries(
    surfaceData.goals.map((g) => [g.exercise, g]),
  )

  return (
    <div className="flex flex-col gap-8">
      {loadError ? <LoadErrorBanner message={loadError} /> : null}

      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
        <div className="flex flex-col items-center gap-4">
          <ActivityRings rings={rings} size={264} className="w-full max-w-[264px]" />
          <div className="grid w-full max-w-[264px] gap-2">
            {surfaceData.goals.map((goal) => (
              <StreakBadge
                key={goal.exercise}
                exercise={goal.exercise}
                streak={streaks[goal.exercise] ?? { current: 0, longest: 0 }}
                accentColor={goal.color}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {surfaceData.goals.length > 0 ? (
            <QuickLog
              goals={surfaceData.goals}
              lastReps={lastReps}
              onLog={({ exercise, reps }) => logSet(exercise, reps, setBusy, refetch)}
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
            setsToday={setsToday}
            goalsByExercise={goalsByExercise}
            onDelete={(s) => deleteSet(s, setBusy, refetch)}
            busy={busy}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * POST a new strength set, then refetch so rings + list reflect on-disk truth.
 */
async function logSet(
  exercise: string,
  reps: number,
  setBusy: (v: boolean) => void,
  refetch: () => Promise<void>,
): Promise<void> {
  setBusy(true)
  try {
    const res = await fetch('/api/admin/weight-room/sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise, reps }),
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
