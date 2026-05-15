import type { JSX } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { WeightRoomScene } from '@/components/training-facility/scenes/WeightRoomScene'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { PreviewWithSampleDataButton } from '@/components/training-facility/shared/PreviewWithSampleDataButton'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { buildWeightRoomDemoData } from '@/constants/weight-room-demo-fixture'
import { getWeightRoomDataServer } from '@/lib/data/weight-room-server'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
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
 * Weight Room — Today View landing page (#80, #197). Renders the
 * illustrated room full-bleed with floating chrome on top; the scene's
 * wall fixture displays today's activity rings + per-exercise tallies
 * + streaks so visitors see the room "in use" without any data-entry UI.
 *
 * Admin owners log sets on the separate
 * `/training-facility/weight-room/log` route. The sub-nav surfaces the
 * Log + Settings pills only to admin viewers — non-admins see Today /
 * History pills only.
 *
 * Empty-state preview (`?preview=demo`): when the real read returns no
 * sets AND the URL has the param, the page substitutes
 * {@link buildWeightRoomDemoData} so the rings still show progress for
 * portfolio reviewers / fresh-clone dev environments. Without the
 * param, the empty state surfaces a floating "Preview with sample data"
 * CTA over the scene.
 */
export default async function TrainingFacilityWeightRoomPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  if (!isTrainingFacilityEnabled()) notFound()

  const realData = await getWeightRoomDataServer().catch(() => null)
  const params = await searchParams
  const previewRequested = isPreviewDemoActive(params.preview)
  const realIsEmpty = realData === null || realData.sets.length === 0
  const isPreviewMode = realIsEmpty && previewRequested
  const showEmptyStateCta = realIsEmpty && !previewRequested
  const data = isPreviewMode ? buildWeightRoomDemoData() : realData

  return (
    <div className="relative h-svh w-full overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      {/* Visually-hidden h1 — accessibility heading + e2e anchor so the
          page still has a named identity for screen readers / Playwright
          even though the scene-first layout has no visible title. */}
      <h1 className="sr-only">Today</h1>
      {/* Scene fills the viewport. The illustrated SVG keeps its own
          aspect ratio via `preserveAspectRatio="xMidYMid meet"`, so on
          a portrait viewport it letterboxes top + bottom; on wider
          viewports it letterboxes left + right. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <WeightRoomScene data={data} />
      </div>

      {/* Floating chrome — `pointer-events: none` on the wrapper so
          empty space passes clicks through to the scene; individual
          chrome elements re-enable pointer events on themselves. */}
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

        <div className="pointer-events-auto absolute inset-x-0 top-20 flex justify-center sm:top-24">
          <WeightRoomSubNav active="today" />
        </div>

        {isPreviewMode ? (
          <div className="pointer-events-auto absolute inset-x-4 top-36 mx-auto max-w-md sm:top-40">
            <PreviewModeBadge description="These rings are illustrative — not Lucas’s real strength logs." />
          </div>
        ) : null}

        {showEmptyStateCta ? (
          <div className="pointer-events-auto absolute inset-x-4 bottom-6 mx-auto max-w-md sm:bottom-10">
            <PreviewWithSampleDataButton
              href="/training-facility/weight-room?preview=demo"
              headline="No strength work logged yet"
              description="Curious what the wall looks like with progress? Load a sample set to see the rings fill, the streak counter come alive, and today's tallies populate."
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
