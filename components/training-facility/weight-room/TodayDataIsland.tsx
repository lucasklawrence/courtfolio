'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react'

import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { PreviewWithSampleDataButton } from '@/components/training-facility/shared/PreviewWithSampleDataButton'
import { buildWeightRoomDemoData } from '@/constants/weight-room-demo-fixture'
import { useAdminSession } from '@/lib/auth/use-admin-session'
import { getWeightRoomData } from '@/lib/data/weight-room'
import { computeStrengthStreaks } from '@/lib/training-facility/strength-streaks'
import {
  filterSetsForDay,
  toLocalDateKey,
  totalsByExercise,
} from '@/lib/training-facility/strength-today'
import {
  TRAINING_FACILITY_PREVIEW_PARAM,
  TRAINING_FACILITY_PREVIEW_VALUE,
  isPreviewDemoActive,
} from '@/lib/training-facility/preview-param'
import type { StrengthSet, WeightRoomData } from '@/types/weight-room'

import { ActivityRings, type RingProgress } from './ActivityRings'
import { QuickLog } from './QuickLog'
import { SetList } from './SetList'
import { StreakBadge } from './StreakBadge'

/**
 * Owns the Today View's shared {@link WeightRoomData} state and the
 * write orchestration around the activity rings, quick-log, and
 * today's-sets list (#80).
 *
 * Three branches once the initial fetch settles:
 *   - real data has anything → render with live data, no preview
 *   - real data is empty + `?preview=demo` → swap in the demo fixture
 *     and show {@link PreviewModeBadge}
 *   - real data is empty + no preview param → show the empty-state
 *     CTA pointing at `?preview=demo` plus a placeholder card
 *
 * Mirror of the Combine + cardio data-island pattern. The page itself
 * is a Server Component (flag check + chrome) and embeds this island
 * inside a {@link Suspense} boundary, because `useSearchParams()`
 * forces dynamic rendering.
 *
 * Admin-gated writes: the QuickLog form and SetList delete buttons
 * only render for admins (per {@link useAdminSession}). Non-admin
 * viewers see the rings + read-only set list, matching the Combine
 * page's "form is admin-only" UX.
 */
export function TodayDataIsland(): JSX.Element {
  const [data, setData] = useState<WeightRoomData | null | undefined>(undefined)
  // `loadError` is the "fetch threw" branch, distinct from `data === null`
  // (the "tables are genuinely empty" branch). Without splitting these,
  // a transient Supabase blip would render the empty-state CTA — which
  // is misleading at best and could mask a real outage. On refetch
  // failure we keep the last successful data and surface the error
  // banner above it instead of nulling the view out.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<boolean>(false)
  // Monotonic request id — same pattern as `CombineDataIsland`. Both
  // mount-time and post-write fetches commit only when the id is still
  // current, so a slow mount fetch can't clobber fresh post-write data.
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
          // Mount-time failure: there's no prior good data to keep, so
          // settle `data` to null so the loading skeleton clears.
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
      // Refetch failure: preserve the previously loaded data so the user
      // doesn't lose their already-rendered view. Surface the error
      // inline; the next successful refetch clears it.
      if (id === requestIdRef.current) {
        setLoadError(err instanceof Error ? err.message : 'Refresh failed.')
      }
    }
  }, [])

  // Empty-state preview (#80, mirrors #160/#162). The fixture is
  // generated relative to *now* so today's ring reads partial — the
  // most informative state for a ring-based UI.
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const previewActive = isPreviewDemoActive(
    searchParams?.get(TRAINING_FACILITY_PREVIEW_PARAM),
  )
  // "Empty" for the Today View means no progress to render — i.e. no
  // sets logged. Goals on their own are configuration, not progress,
  // so a freshly-seeded DB with `pushups` + `pullups` goals and zero
  // sets still counts as empty (mirrors the cardio convention where
  // `sessions.length === 0` alone triggers the empty branch). Without
  // this, the seeded goals fool the page into the populated branch and
  // `?preview=demo` becomes a no-op.
  const realIsEmpty =
    data !== undefined && (data === null || data.sets.length === 0)
  const isPreviewMode = realIsEmpty && previewActive
  const showEmptyStateCta = realIsEmpty && !previewActive

  const surfaceData = useMemo<WeightRoomData | null>(() => {
    if (isPreviewMode) return buildWeightRoomDemoData()
    if (data === undefined) return null
    return data
  }, [data, isPreviewMode])

  const { isAdmin } = useAdminSession()

  // Loading skeleton — keep light, the rings render fast once data lands.
  if (data === undefined) {
    return (
      <div
        className="rounded-[1.6rem] border border-white/10 bg-black/30 p-10 text-center text-sm text-white/55"
        data-testid="today-loading"
      >
        Loading today’s sets…
      </div>
    )
  }

  // Real-empty + no preview: show the CTA only. Once a real set lands
  // the page reroutes to the populated branch on next refetch. The
  // mount-time fetch error case also lands here (data === null and
  // sets.length === 0 are equivalent here); the inline error banner
  // tells the user the underlying state is "we couldn't read" not "no
  // data exists yet."
  if (showEmptyStateCta) {
    return (
      <div className="space-y-6">
        {loadError ? <LoadErrorBanner message={loadError} /> : null}
        <PreviewWithSampleDataButton
          href={`${pathname}?${TRAINING_FACILITY_PREVIEW_PARAM}=${TRAINING_FACILITY_PREVIEW_VALUE}`}
          headline="No strength work logged yet"
          description="Curious what the rings look like populated? Load a sample set to see today’s ring fill, the streak badge, and the timestamped log."
        />
        {isAdmin && surfaceData ? (
          <AdminQuickLog
            goals={surfaceData.goals}
            setsToday={[]}
            busy={busy}
            setBusy={setBusy}
            refetch={refetch}
          />
        ) : null}
      </div>
    )
  }

  // The fixture branch always passes through `surfaceData`. The
  // `surfaceData` cannot be null here (we've handled both undefined
  // and empty branches above).
  if (!surfaceData) return <></>

  const todayKey = toLocalDateKey(new Date())
  const setsToday = filterSetsForDay(surfaceData.sets, todayKey)
  const totals = totalsByExercise(setsToday)
  const rings: RingProgress[] = surfaceData.goals.map((goal) => ({
    goal,
    totalReps: totals.get(goal.exercise) ?? 0,
  }))
  const streaks = computeStrengthStreaks(surfaceData.sets, surfaceData.goals)
  const lastReps = computeLastRepsByExercise(surfaceData.sets)
  const goalsByExercise = Object.fromEntries(
    surfaceData.goals.map((g) => [g.exercise, g]),
  )

  return (
    <div className="flex flex-col gap-8">
      {loadError ? <LoadErrorBanner message={loadError} /> : null}
      {isPreviewMode ? (
        <PreviewModeBadge description="These rings are illustrative — not Lucas’s real strength logs." />
      ) : null}

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
          {isAdmin && !isPreviewMode ? (
            <AdminQuickLog
              goals={surfaceData.goals}
              setsToday={setsToday}
              busy={busy}
              setBusy={setBusy}
              refetch={refetch}
              lastReps={lastReps}
            />
          ) : null}
          <SetList
            setsToday={setsToday}
            goalsByExercise={goalsByExercise}
            onDelete={
              isAdmin && !isPreviewMode
                ? (s) => deleteSet(s, setBusy, refetch)
                : undefined
            }
            busy={busy}
          />
        </div>
      </div>
    </div>
  )
}

interface AdminQuickLogProps {
  goals: WeightRoomData['goals']
  setsToday: readonly StrengthSet[]
  busy: boolean
  setBusy: (v: boolean) => void
  refetch: () => Promise<void>
  lastReps?: Record<string, number>
}

/**
 * Admin-only QuickLog wrapper. Owns the POST → refetch handshake so
 * the parent island can stay declarative; busy state lifts up so the
 * SetList's delete buttons disable while a quick-log is in flight
 * (and vice-versa) — prevents racey double-submits.
 */
function AdminQuickLog({
  goals,
  busy,
  setBusy,
  refetch,
  lastReps,
}: AdminQuickLogProps): JSX.Element {
  async function handleLog({
    exercise,
    reps,
  }: {
    exercise: string
    reps: number
  }): Promise<void> {
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
  return <QuickLog goals={goals} lastReps={lastReps} onLog={handleLog} busy={busy} />
}

/**
 * Drop one logged set via the admin DELETE endpoint, then refetch so
 * the rings + list reflect on-disk truth. Confirms with the user
 * first because the action isn't undoable client-side and undoing it
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
  // The data layer returns sets oldest → newest. Walk forward and
  // overwrite so the final value per exercise is the latest.
  for (const s of sets) {
    out[s.exercise] = s.reps
  }
  return out
}

/**
 * Inline banner that surfaces a load / refetch failure above the
 * existing UI. Distinct from the empty-state CTA so the user can tell
 * "we couldn't read" apart from "no data yet."
 */
function LoadErrorBanner({ message }: { message: string }): JSX.Element {
  return (
    <p
      role="alert"
      data-testid="today-load-error"
      className="rounded-2xl border border-rose-400/30 bg-rose-950/40 px-4 py-3 font-mono text-[12px] text-rose-200"
    >
      {message}
    </p>
  )
}
