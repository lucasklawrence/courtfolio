import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { TrainingFacilitySubareaShell } from '@/components/training-facility/TrainingFacilitySubareaShell'
import { notFound } from 'next/navigation'

/**
 * Renders the placeholder Gym route so the Training Facility shell has a live destination.
 */
export default function TrainingFacilityGymPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <TrainingFacilitySubareaShell
      eyebrow="Cardio wing"
      title="The Gym"
      description="This is where the cardio side of the Training Facility takes shape: the migrated stair-climber dashboard, running and walking views, and the stat wall that pulls the metrics into one room."
      accentClassName="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500"
      // Temporary CTA — surfaces the first Gym detail view (PRD §7.4) before
      // the Gym scene SVG (#61) lands and wires the click directly on the
      // stair-climber group. Goes away with the placeholder shell once #61 merges.
      cta={{
        href: '/training-facility/gym/stair',
        label: 'Open stair climber',
        helper:
          'First Gym detail surface — HR zone bars, per-session avg HR, and the session log.',
      }}
      nextSteps={[
        'Build the Gym scene art and equipment entry points.',
        'Wire cardio.json into the room-level visualizations.',
        'Add the All Cardio overview and per-equipment detail views.',
      ]}
    />
  )
}
