import { notFound } from 'next/navigation'

import { HrZoneComparison } from '@/components/training-facility/gym/HrZoneComparison'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * HR-zone reconciliation view (#261) — Apple Watch vs OrangeTheory zones on one
 * shared, data-derived max HR. Reached from a link in the OrangeTheory detail
 * view; gated behind the Training Facility feature flag for staged rollout,
 * matching the sibling gym detail pages.
 *
 * No `<Suspense>` boundary (like the OTF page) because `HrZoneComparison`
 * doesn't read `useSearchParams()` — it owns its own loading panel and fetches
 * both datasets client-side from a mount effect.
 */
export default function TrainingFacilityGymZonesPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return <HrZoneComparison />
}
