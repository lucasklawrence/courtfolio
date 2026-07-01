import { notFound } from 'next/navigation'

import { OtfDetailView } from '@/components/training-facility/gym/OtfDetailView'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * OrangeTheory detail view (#256) — studio-class data from the OTbeat
 * ingestion pipeline (#251). Reachable from the OrangeTheory signpost on the
 * Gym scene; gated behind the Training Facility feature flag for staged
 * rollout, matching the sibling treadmill/track/stair pages.
 *
 * No `<Suspense>` boundary here (unlike the cardio detail pages) because
 * `OtfDetailView` doesn't read `useSearchParams()` — it owns its own loading
 * panel and fetches client-side from a mount effect.
 */
export default function TrainingFacilityGymOtfPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return <OtfDetailView />
}
