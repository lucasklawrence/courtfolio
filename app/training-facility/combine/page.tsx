import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { TrainingFacilitySubareaShell } from '@/components/training-facility/TrainingFacilitySubareaShell'
import { notFound } from 'next/navigation'

/**
 * Renders the placeholder Combine route so the Training Facility shell has a live destination.
 */
export default function TrainingFacilityCombinePage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <TrainingFacilitySubareaShell
      eyebrow="Movement wing"
      title="The Combine"
      description="This room is reserved for benchmark testing: sprint, shuttle, jump, and bodyweight context, all framed like a basketball combine rather than a generic dashboard."
      accentClassName="bg-gradient-to-r from-sky-300 via-cyan-400 to-blue-500"
      nextSteps={[
        'Build the Combine room scene and scoreboard framing.',
        'Wire benchmark entry and results views into the destination.',
        'Connect the shared date filter and bodyweight overlays.',
      ]}
    />
  )
}
