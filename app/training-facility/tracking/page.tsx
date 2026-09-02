import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { TrackingHubCard } from '@/components/training-facility/TrackingHubCard'
import { isGymEnabled, isWeightRoomEnabled } from '@/lib/feature-flags'

/**
 * Tracking hub (#345) — the public entry point to the fitness-tracking work.
 *
 * Exists because the two published areas don't link to each other and the lobby
 * that would join them is still dark: the Gym and Weight Room ship on their own
 * flags, the lobby corridor is unfinished, and the Projects binder gives a card
 * exactly one `href`. This is that one href, and it is the only surface here
 * whose layout is fully under our control.
 *
 * Deliberately links the *data* surfaces rather than the illustrated scenes
 * (`/gym`, `/weight-room`). The scenes are the part still being designed, so
 * they stay reachable via each area's own navigation without being promoted to
 * a visitor arriving cold.
 *
 * Every card is gated on its own area's flag, so this page can never offer a
 * door into a 404 — the same rule the lobby and the scene doors follow.
 * 404s only when *both* areas are dark, since there would be nothing to hub.
 */
export default function TrainingFacilityTrackingPage(): JSX.Element {
  const gymLive = isGymEnabled()
  const weightRoomLive = isWeightRoomEnabled()

  if (!gymLive && !weightRoomLive) notFound()

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.13),transparent_32%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <BackToCourtButton />

        <header className="mt-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
            Training Facility · Tracking
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-5xl">
            Everything I train, logged
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Every set and every class goes into one Postgres database, and these pages read it back.
            No fitness app in the loop &mdash; the ingest, the schema, the charts and the
            achievement logic are all mine, which means I get to ask questions an app would never
            answer.
          </p>
        </header>

        <section aria-label="Tracking surfaces" className="mt-10">
          <ul className="grid gap-4 sm:grid-cols-2">
            {weightRoomLive ? (
              <>
                <li>
                  <TrackingHubCard
                    eyebrow="Strength"
                    title="Trophy Room"
                    icon="🏆"
                    accent="#FACC15"
                    href="/training-facility/weight-room/achievements"
                    description="An achievement wall over the set log — hundred-rep days, four-figure weeks, streaks, tonnage. Nothing is stored as earned; every badge is recomputed from scratch on each visit."
                  />
                </li>
                <li>
                  <TrackingHubCard
                    eyebrow="Strength"
                    title="The Grind"
                    icon="📊"
                    accent="#EA580C"
                    href="/training-facility/weight-room/history"
                    description="A year of daily volume as a heatmap, weekly trends per movement, and the load-management view that watches how fast the ramp climbs rather than how big it is."
                  />
                </li>
              </>
            ) : null}
            {gymLive ? (
              <li>
                <TrackingHubCard
                  eyebrow="Cardio"
                  title="OrangeTheory"
                  icon="🔥"
                  accent="#F97316"
                  href="/training-facility/gym/otf"
                  description="Class history parsed straight out of the studio's emails: splat points, time in zone, and a monthly mileage tracker that lights up marathon badges as the miles add up."
                />
              </li>
            ) : null}
          </ul>
        </section>

        <section aria-label="How it is built" className="mt-12 pb-16">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
            Under the hood
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#e8d5be]/85">
            Next.js App Router on Vercel, Postgres behind Supabase with row-level security, and a
            hand-rolled rough.js chart kit so the graphs look drawn rather than generated. Sessions
            arrive by scheduled ingest; sets I log by hand. The read path is entirely server-side
            &mdash; these pages ship no database credentials to your browser.
          </p>
        </section>
      </div>
    </div>
  )
}
