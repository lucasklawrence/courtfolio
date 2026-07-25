import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { LobbyScene } from '@/components/training-facility/scenes/LobbyScene'

/**
 * Top-level Training Facility scene rendered from the `/training-facility`
 * route. Presents the facility as a place you stand inside — a
 * one-point-perspective corridor ({@link LobbyScene}) whose three doors
 * lead to the sub-areas — rather than a menu of buttons. Floating chrome
 * (Home Court button + a facility wordmark) sits over the full-bleed
 * scene, matching the scene-first layout used by the Gym and Weight Room.
 */
export function TrainingFacilityShell() {
  return (
    <div className="relative h-svh w-full overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      {/* Visually-hidden h1 — accessibility heading + e2e anchor. The
          scene-first layout carries its wayfinding on the door signs, so
          there is no visible page title. */}
      <h1 className="sr-only">Training Facility</h1>

      <div className="absolute inset-0 flex items-center justify-center">
        <LobbyScene />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6 lg:p-8">
          <BackToCourtButton />
          <div className="rounded-full border border-white/15 bg-[#120d0a]/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 backdrop-blur">
            Training Facility
          </div>
        </div>
      </div>
    </div>
  )
}
