import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { OtfDetailView } from '@/components/training-facility/gym/OtfDetailView'
import { isAdminRequest } from '@/lib/auth/admin-session'
import { getOtfDataServer, getOtfMileageAwardsServer } from '@/lib/data/otf-server'
import { firstRejectionMessage, settledOr } from '@/lib/data/settled'
import { isGymEnabled } from '@/lib/feature-flags'

/**
 * OrangeTheory detail view (#256) — studio-class data from the OTbeat
 * ingestion pipeline (#251). Reachable from the OrangeTheory signpost on the
 * Gym scene; gated behind the Gym feature flag for staged rollout, matching the
 * sibling treadmill/track/stair pages.
 *
 * Reads sessions, the milestone ladder, and admin status server-side and passes
 * them down (#345). The view used to fetch the first two from a mount effect
 * and resolve the third with `useAdminSession`; both pulled the browser
 * Supabase client — and therefore `NEXT_PUBLIC_SUPABASE_ANON_KEY` — into a
 * publicly reachable bundle.
 *
 * Only the session read can surface an error. The ladder degrades to an empty
 * array (the mileage section then renders miles with no badges) and the admin
 * check to `false`, exactly as before — neither should blank a page that has
 * sessions to show. A session failure is forwarded as a message rather than
 * rethrown so the view keeps its shell instead of hitting an error boundary.
 */
export default async function TrainingFacilityGymOtfPage(): Promise<JSX.Element> {
  if (!isGymEnabled()) notFound()

  const [otfResult, awardsResult, adminResult] = await Promise.allSettled([
    getOtfDataServer(),
    getOtfMileageAwardsServer(),
    isAdminRequest(),
  ])

  return (
    <OtfDetailView
      otf={settledOr(otfResult, null)}
      mileageAwards={settledOr(awardsResult, [])}
      isAdmin={settledOr(adminResult, false)}
      loadError={firstRejectionMessage(otfResult)}
    />
  )
}
