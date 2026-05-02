import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { GymScene } from '@/components/training-facility/scenes/GymScene'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { PreviewWithSampleDataButton } from '@/components/training-facility/shared/PreviewWithSampleDataButton'
import { CARDIO_DEMO_DATA } from '@/constants/cardio-demo-fixture'
import { getCardioDataServer } from '@/lib/data/cardio-server'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
// Server component — must import the predicate from the non-`'use client'`
// module. The same predicate is re-exported from `use-cardio-preview.ts`
// for client callers, but importing it through that boundary here would
// trigger Next 15+'s "Attempted to call ... from the server" guard.
import { isPreviewDemoActive } from '@/lib/training-facility/preview-param'

/** Search-params shape Next.js passes to a server-rendered page. */
interface PageProps {
  /**
   * Async per request-context (Next 15+). Only the `preview` key is
   * consumed here, but accept the full shape so additional params are
   * passed through unchanged.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `/training-facility/gym` route — the cardio sub-area scene.
 *
 * Server-reads cardio data from Supabase so the wall fixtures (HR
 * monitor, VO2max whiteboard, wall scoreboard — PRD §7.4) hydrate with
 * live data on the first paint. Uses {@link getCardioDataServer} rather
 * than the browser-facing `getCardioData()` because Supabase's browser
 * client wires session storage to `window`-scoped APIs that aren't
 * available in a Server Component. Before any Apple Health import has
 * landed the read returns `null` and the fixtures fall back to painted
 * placeholder values. Gated behind the same Training Facility flag as
 * the parent shell so the route family stays in sync.
 *
 * Empty-state preview (#162): when the real read returns no sessions
 * AND the URL has `?preview=demo`, the page substitutes
 * {@link CARDIO_DEMO_DATA} so portfolio reviewers / fresh-clone dev
 * environments see the wall populated. Without the param the empty
 * state shows a "Preview with sample data" CTA. Real data always wins.
 */
export default async function TrainingFacilityGymPage({ searchParams }: PageProps) {
  if (!isTrainingFacilityEnabled()) notFound()
  // Catch transient read errors so a flaky Supabase response doesn't
  // 500 the whole page — the fixtures gracefully fall back to placeholders.
  const realCardioData = await getCardioDataServer().catch(() => null)
  const params = await searchParams
  // Use the shared `isPreviewDemoActive` so server and client agree
  // on the multi-value edge case (`?preview=demo&preview=other`
  // arrives here as `['demo', 'other']` but as `'demo'` from
  // `useSearchParams().get`). One predicate, one truth.
  const previewRequested = isPreviewDemoActive(params.preview)
  const realIsEmpty = realCardioData === null || realCardioData.sessions.length === 0
  const isPreviewMode = realIsEmpty && previewRequested
  const showEmptyStateCta = realIsEmpty && !previewRequested
  const cardioData = isPreviewMode ? CARDIO_DEMO_DATA : realCardioData

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,214,170,0.16),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_55%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BackToCourtButton />
          <Link
            href="/training-facility"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← Back to Training Facility
          </Link>
        </div>

        <div className="mt-8 text-center sm:mt-12">
          <div className="inline-flex rounded-full border border-amber-100/25 bg-[#2b1a13]/80 px-5 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.42em] text-amber-100/85 sm:text-xs">
            Cardio wing
          </div>
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[0.08em] text-[#fff6ea] sm:text-5xl lg:text-6xl">
            The Gym
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#e8d5be] sm:text-base sm:leading-7">
            Stair climber dead center, treadmill on the left, indoor track
            curving along the back wall. Tap a piece of equipment for its
            detail view, or zoom out to the stats wall.
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              href="/training-facility/gym/overview"
              className="rounded-full border border-amber-200/30 bg-amber-200/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-amber-100 transition hover:bg-amber-200/20"
            >
              View all cardio →
            </Link>
          </div>
        </div>

        {isPreviewMode ? (
          <div className="mt-6">
            <PreviewModeBadge description="These cardio numbers are illustrative — not Lucas’s real Apple Health import." />
          </div>
        ) : null}
        {showEmptyStateCta ? (
          <div className="mt-6">
            <PreviewWithSampleDataButton
              href="/training-facility/gym?preview=demo"
              headline="No cardio data imported yet"
              description="Curious what the wall looks like with data? Load a sample set to see the HR monitor, VO2max whiteboard, and scoreboard hydrate."
            />
          </div>
        ) : null}

        <div className="mt-8 flex-1 sm:mt-10">
          <div className="mx-auto w-full max-w-6xl rounded-[1.6rem] border border-white/10 bg-black/35 p-3 shadow-[0_28px_70px_rgba(0,0,0,0.4)] sm:p-5">
            <GymScene cardioData={cardioData} />
          </div>
        </div>
      </div>
    </div>
  )
}
