import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { TrainingFacilityDoor } from '@/components/training-facility/TrainingFacilityDoor'

/**
 * Main Training Facility shell scene rendered from the new top-level route.
 *
 * This deliberately ships a route-first hallway scene with wired navigation,
 * while leaving the bespoke Gym / Combine SVG build for the follow-up issue.
 */
export function TrainingFacilityShell() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-[#160f0c] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,214,170,0.18),transparent_28%),radial-gradient(circle_at_bottom,rgba(117,65,35,0.35),transparent_35%),linear-gradient(180deg,#271711_0%,#160f0c_50%,#0f0907_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-36 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_8%,rgba(255,255,255,0.06)_8%,rgba(255,255,255,0.06)_9%,transparent_9%,transparent_18%)] opacity-40"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.14)_8%,rgba(0,0,0,0.55)_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <BackToCourtButton />
          <div className="rounded-full border border-amber-100/20 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-amber-100/75">
            Phase 1 shell
          </div>
        </div>

        <div className="mx-auto mt-10 w-full max-w-4xl text-center">
          <div className="mx-auto inline-flex rounded-full border border-amber-100/25 bg-[#2b1a13]/80 px-5 py-2 text-xs font-semibold uppercase tracking-[0.42em] text-amber-100/85">
            Training Facility
          </div>
          <h1 className="mt-5 text-4xl font-black uppercase tracking-[0.08em] text-[#fff6ea] sm:text-6xl">
            Pick a door.
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-[#e8d5be] sm:text-lg">
            The Gym carries the cardio side of the project. The Combine holds the
            movement benchmark work. The Weight Room stays on the roadmap as a later
            expansion, but the entrance is already reserved here in the space.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          <TrainingFacilityDoor
            eyebrow="Cardio wing"
            title="The Gym"
            href="/training-facility/gym"
            description="The cardio dashboard moves into courtfolio here: stair-climber work, running, walking, and the stat wall that ties them together."
            doorwayHint="Stairs + treadmill"
            footer="Route live now"
            tone="amber"
          />
          <TrainingFacilityDoor
            eyebrow="Movement wing"
            title="The Combine"
            href="/training-facility/combine"
            description="This side houses the benchmark tests: shuttle times, sprint work, jump numbers, and the bodyweight context that makes them meaningful."
            doorwayHint="Cones + stopwatch"
            footer="Route live now"
            tone="sky"
          />
          <TrainingFacilityDoor
            eyebrow="Roadmap"
            title="Weight Room"
            description="Grease-the-groove bodyweight work belongs here later. For now, the room stays blocked off so the Phase 1 shell matches the PRD without opening a dead route."
            doorwayHint="Coming soon"
            footer="Reserved for post-v1"
            tone="slate"
            disabled
          />
        </div>
      </div>
    </div>
  )
}
