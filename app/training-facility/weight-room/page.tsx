import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { WeightRoomScene } from '@/components/training-facility/scenes/WeightRoomScene'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { PreviewWithSampleDataButton } from '@/components/training-facility/shared/PreviewWithSampleDataButton'
import { TodayProgressPanel } from '@/components/training-facility/weight-room/TodayProgressPanel'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { isAdminRequest } from '@/lib/auth/admin-session'
import { buildWeightRoomDemoData } from '@/constants/weight-room-demo-fixture'
import { getWeightRoomDataServer } from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
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
 * Weight Room — Today View landing page (#80, #197). From `lg` it renders the
 * illustrated room full-bleed with floating chrome on top; the scene's wall
 * fixture displays today's activity rings + per-exercise tallies + streaks so
 * visitors see the room "in use" without any data-entry UI. Below `lg` the page
 * scrolls: chrome, then the scene, then {@link TodayProgressPanel} stating the
 * board at a readable size.
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
  if (!isWeightRoomEnabled()) notFound()

  // `isAdmin` is resolved here rather than by the sub-nav so this page ships
  // no browser Supabase client — see WeightRoomSubNavProps.isAdmin (#345).
  const [realData, isAdmin] = await Promise.all([
    getWeightRoomDataServer().catch(() => null),
    isAdminRequest().catch(() => false),
  ])
  const params = await searchParams
  const previewRequested = isPreviewDemoActive(params.preview)
  const realIsEmpty = realData === null || realData.sets.length === 0
  const isPreviewMode = realIsEmpty && previewRequested
  const showEmptyStateCta = realIsEmpty && !previewRequested
  const data = isPreviewMode ? buildWeightRoomDemoData() : realData

  return (
    <div className="relative min-h-svh w-full overflow-x-hidden bg-[#120d0a] text-[#f7ead9] lg:h-svh lg:overflow-hidden">
      {/* Visually-hidden h1 — accessibility heading + e2e anchor so the
          page still has a named identity for screen readers / Playwright
          even though the scene-first layout has no visible title. */}
      <h1 className="sr-only">Today</h1>

      {/* Chrome. Below `lg` it flows above the scene as ordinary content. From
          `lg` it floats over the full-bleed scene: `pointer-events: none` on the
          wrapper so empty space passes clicks through, with individual chrome
          elements re-enabling pointer events on themselves. */}
      <div className="lg:pointer-events-none lg:absolute lg:inset-0 lg:z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 lg:pointer-events-auto lg:absolute lg:inset-x-0 lg:top-0 lg:p-8">
          <BackToCourtButton />
          <FacilityBackLink />
        </div>

        <div className="px-4 lg:pointer-events-auto lg:absolute lg:inset-x-0 lg:top-24 lg:flex lg:justify-center lg:px-0">
          <WeightRoomSubNav active="today" isAdmin={isAdmin} />
        </div>

        {isPreviewMode ? (
          <div className="mx-4 mt-4 max-w-sm lg:pointer-events-auto lg:absolute lg:inset-x-4 lg:top-40 lg:mx-auto lg:mt-0">
            <PreviewModeBadge description="These rings are illustrative — not Lucas’s real strength logs." />
          </div>
        ) : null}

        {showEmptyStateCta ? (
          <div className="mx-4 mt-4 max-w-sm lg:pointer-events-auto lg:absolute lg:inset-x-4 lg:top-40 lg:mx-auto lg:mt-0">
            <PreviewWithSampleDataButton
              href="/training-facility/weight-room?preview=demo"
              headline="No strength work logged yet"
              description="Curious what the wall looks like with progress? Load a sample set to see the rings fill, the streak counter come alive, and today's tallies populate."
            />
          </div>
        ) : null}
      </div>

      {/* The scene. Below `lg` it sits in the page flow at its own 16:9 shape, so
          it fills the width rather than letterboxing inside a tall viewport. From
          `lg` it fills the viewport, and the SVG's
          `preserveAspectRatio="xMidYMid meet"` letterboxes it as needed. */}
      <div className="mt-4 aspect-video w-full lg:absolute lg:inset-0 lg:mt-0 lg:flex lg:aspect-auto lg:items-center lg:justify-center">
        <WeightRoomScene data={data} />
      </div>

      {/* The wall's text is unreadable at this scale, so state the same board as
          page content below `lg`. Hidden with CSS, not a viewport check, so the
          server render already matches. */}
      <TodayProgressPanel data={data} className="mx-4 my-6 lg:hidden" />
    </div>
  )
}
