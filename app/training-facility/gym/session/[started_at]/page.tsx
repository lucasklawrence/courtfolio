import { notFound } from 'next/navigation'

import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { getCardioSession } from '@/lib/data/cardio-server'
import { SessionDetailView } from '@/components/training-facility/gym/SessionDetailView'

/**
 * Per-session detail page (PRD §7.4, #165) — `/training-facility/gym/session/[started_at]`.
 *
 * Server Component reads one cardio session + its full HR sample stream
 * via `getCardioSession`, then hands the data to the client-side
 * {@link SessionDetailView} which owns the chart-width `ResizeObserver`.
 *
 * The route param is `started_at`, the session's primary key. Session log
 * rows in `AllCardioOverview` / `StairDetailView` / `TreadmillDetailView`
 * / `TrackDetailView` link here with `encodeURIComponent` applied so the
 * `:` and `+` in the ISO timestamp survive the URL roundtrip. We
 * `decodeURIComponent` here before the DB lookup.
 *
 * 404 routes:
 *   - Training facility flag off (`isTrainingFacilityEnabled === false`).
 *   - The decoded `started_at` doesn't match any session (`getCardioSession`
 *     resolves to `null`).
 */
export default async function TrainingFacilityGymSessionPage({
  params,
}: {
  params: Promise<{ started_at: string }>
}) {
  if (!isTrainingFacilityEnabled()) notFound()

  const { started_at: rawStartedAt } = await params
  const startedAt = decodeURIComponent(rawStartedAt)

  const detail = await getCardioSession(startedAt).catch(() => null)
  if (!detail) notFound()

  return <SessionDetailView session={detail.session} samples={detail.samples} />
}
