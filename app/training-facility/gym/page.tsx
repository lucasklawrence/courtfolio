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
   * Async per-request context (Next 15+). Only the `preview` key is
   * consumed here, but accept the full shape so additional params are
   * passed through unchanged.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `/training-facility/gym` route — the cardio sub-area scene. Renders
 * the illustrated room full-bleed (#197) with floating chrome on top;
 * the wall fixtures (HR monitor, VO2max whiteboard, scoreboard) carry
 * the data display inside the scene itself.
 *
 * Server-reads cardio data from Supabase so the wall fixtures hydrate
 * on the first paint. Before any Apple Health import has landed the
 * read returns `null` and the fixtures fall back to painted
 * placeholder values.
 *
 * Empty-state preview (`?preview=demo`): when the real read is empty
 * AND the URL has the param, the page substitutes
 * {@link CARDIO_DEMO_DATA} so portfolio reviewers / fresh-clone dev
 * environments see the wall populated. Without the param, a floating
 * "Preview with sample data" CTA over the scene offers the opt-in.
 */
export default async function TrainingFacilityGymPage({ searchParams }: PageProps) {
  if (!isTrainingFacilityEnabled()) notFound()
  // Catch transient read errors so a flaky Supabase response doesn't
  // 500 the whole page — the fixtures gracefully fall back to placeholders.
  const realCardioData = await getCardioDataServer().catch(() => null)
  const params = await searchParams
  const previewRequested = isPreviewDemoActive(params.preview)
  const realIsEmpty = realCardioData === null || realCardioData.sessions.length === 0
  const isPreviewMode = realIsEmpty && previewRequested
  const showEmptyStateCta = realIsEmpty && !previewRequested
  const cardioData = isPreviewMode ? CARDIO_DEMO_DATA : realCardioData

  return (
    <div className="relative h-svh w-full overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      {/* Visually-hidden h1 — accessibility heading + e2e anchor so the
          page still has a named identity for screen readers / Playwright
          even though the scene-first layout has no visible title. */}
      <h1 className="sr-only">The Gym</h1>
      <div className="absolute inset-0 flex items-center justify-center">
        <GymScene cardioData={cardioData} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6 lg:p-8">
          <BackToCourtButton />
          <Link
            href="/training-facility"
            className="rounded-full border border-white/15 bg-[#120d0a]/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 backdrop-blur transition hover:bg-[#120d0a]/95"
          >
            ← Training Facility
          </Link>
        </div>

        {isPreviewMode ? (
          <div className="pointer-events-auto absolute inset-x-4 top-20 mx-auto max-w-md sm:top-24">
            <PreviewModeBadge description="These cardio numbers are illustrative — not Lucas’s real Apple Health import." />
          </div>
        ) : null}

        {showEmptyStateCta ? (
          <div className="pointer-events-auto absolute inset-x-4 bottom-6 mx-auto max-w-md sm:bottom-10">
            <PreviewWithSampleDataButton
              href="/training-facility/gym?preview=demo"
              headline="No cardio data imported yet"
              description="Curious what the wall looks like with data? Load a sample set to see the HR monitor, VO2max whiteboard, and scoreboard hydrate."
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
