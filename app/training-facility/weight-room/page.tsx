import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FacilityBackLink } from '@/components/training-facility/FacilityBackLink'
import { WeightRoomScene } from '@/components/training-facility/scenes/WeightRoomScene'
import { PreviewModeBadge } from '@/components/training-facility/shared/PreviewModeBadge'
import { PreviewWithSampleDataButton } from '@/components/training-facility/shared/PreviewWithSampleDataButton'
import { TodayProgressPanel } from '@/components/training-facility/weight-room/TodayProgressPanel'
import { TodayRollover } from '@/components/training-facility/weight-room/TodayRollover'
import { WeightRoomSubNav } from '@/components/training-facility/weight-room/WeightRoomSubNav'
import { isAdminRequest } from '@/lib/auth/admin-session'
import { buildWeightRoomDemoData } from '@/constants/weight-room-demo-fixture'
import { getWeightRoomDataServer } from '@/lib/data/weight-room-server'
import { isWeightRoomEnabled } from '@/lib/feature-flags'
import { isPreviewDemoActive } from '@/lib/training-facility/preview-param'
import { buildTodayBoard } from '@/lib/training-facility/today-board'
import { PACIFIC_CLOCK } from '@/lib/training-facility/clock'
import type { WeightRoomData } from '@/types/weight-room'

/** The Today page's dataset read, keeping a failure apart from an empty log. */
interface TodayRead {
  /** The dataset; `null` when the tables are empty or the read failed. */
  data: WeightRoomData | null
  /** `true` when the read threw, so `data === null` says nothing about the log. */
  failed: boolean
}

/**
 * Read the Weight Room dataset without letting a failure pass for an empty log.
 * A Supabase blip would otherwise invite the visitor to "preview sample data"
 * because nothing is logged yet, which isn't true.
 */
async function readTodayData(): Promise<TodayRead> {
  try {
    return { data: await getWeightRoomDataServer(), failed: false }
  } catch (err) {
    console.error('[weight-room] Today read failed', err)
    return { data: null, failed: true }
  }
}

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
 * CTA over the scene. A failed read is told apart from an empty one: it gets a
 * "couldn't load" notice (still offering the sample data) instead of the claim
 * that nothing has been logged.
 *
 * {@link TodayRollover} keeps an open tab on the current Pacific day, since the
 * board is computed here on the server.
 */
export default async function TrainingFacilityWeightRoomPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  if (!isWeightRoomEnabled()) notFound()

  // `isAdmin` is resolved here rather than by the sub-nav so this page ships
  // no browser Supabase client — see WeightRoomSubNavProps.isAdmin (#345).
  const [read, isAdmin] = await Promise.all([readTodayData(), isAdminRequest().catch(() => false)])
  const realData = read.data
  const params = await searchParams
  const previewRequested = isPreviewDemoActive(params.preview)
  // A failed read still allows the sample data on request: the badge says it's
  // illustrative, and the preview is the only way to see the wall when the
  // database is out of reach (the e2e job has no credentials at all).
  const realIsEmpty = realData === null || realData.sets.length === 0
  const isPreviewMode = realIsEmpty && previewRequested
  const showEmptyStateCta = realIsEmpty && !previewRequested && !read.failed
  const showLoadError = read.failed && !previewRequested
  const data = isPreviewMode ? buildWeightRoomDemoData() : realData
  // Computed here so the browser receives these rows and not the whole set
  // history. Day keys are Pacific wherever this runs, so there is no viewer
  // clock to wait for.
  const now = new Date()
  const board = buildTodayBoard(data, now)

  return (
    <div className="relative min-h-svh w-full bg-[#120d0a] text-[#f7ead9] lg:h-svh lg:overflow-hidden">
      {/* Visually-hidden h1 — accessibility heading + e2e anchor so the
          page still has a named identity for screen readers / Playwright
          even though the scene-first layout has no visible title. */}
      <h1 className="sr-only">Today</h1>

      {/* Chrome. Below `lg` it flows above the scene as ordinary content. From
          `lg` it floats over the full-bleed scene: `pointer-events: none` on the
          wrapper so empty space passes clicks through, with individual chrome
          elements re-enabling pointer events on themselves.

          The sub-nav and the notices sit on the right. The wall board hangs left
          of centre (x 340–660 of the 1600-wide scene), so centred chrome landed
          on the board and its "today" heading at common desktop sizes, while the
          right side of the wall stays clear from 1024 to 1920 wide. */}
      <div className="lg:pointer-events-none lg:absolute lg:inset-0 lg:z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 lg:pointer-events-auto lg:absolute lg:inset-x-0 lg:top-0 lg:p-8">
          <BackToCourtButton />
          <FacilityBackLink />
        </div>

        {/* One right-hand column from `lg`, so the notices always sit below the
            sub-nav however many rows it wraps to. Capped at half the viewport,
            which keeps it right of the board; the admin nav (seven pills) wraps
            rather than reaching across. */}
        <div className="lg:pointer-events-auto lg:absolute lg:right-8 lg:top-24 lg:flex lg:max-w-[50vw] lg:flex-col lg:items-end lg:gap-4">
          <div className="px-4 lg:px-0">
            <WeightRoomSubNav active="today" isAdmin={isAdmin} className="lg:justify-end" />
          </div>

          {isPreviewMode ? (
            <div className="mx-4 mt-4 max-w-sm lg:mx-0 lg:mt-0 lg:w-96">
              <PreviewModeBadge description="These rings are illustrative — not Lucas’s real strength logs." />
            </div>
          ) : null}

          {showLoadError ? (
            <div
              role="status"
              data-testid="today-load-error"
              className="mx-4 mt-4 max-w-sm lg:mx-0 lg:mt-0 lg:w-96"
            >
              <PreviewWithSampleDataButton
                href="/training-facility/weight-room?preview=demo"
                headline="Couldn’t load the strength log"
                description="The log couldn't be read just now, so today's board is left out rather than shown empty. Load a sample set to see how the wall looks with progress."
              />
            </div>
          ) : null}

          {showEmptyStateCta ? (
            <div className="mx-4 mt-4 max-w-sm lg:mx-0 lg:mt-0 lg:w-96">
              <PreviewWithSampleDataButton
                href="/training-facility/weight-room?preview=demo"
                headline="No strength work logged yet"
                description="Curious what the wall looks like with progress? Load a sample set to see the rings fill, the streak counter come alive, and today's tallies populate."
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* The scene. Below `lg` it sits in the page flow at its own 16:9 shape, so
          it fills the width rather than letterboxing inside a tall viewport. From
          `lg` it fills the viewport, and the SVG's
          `preserveAspectRatio="xMidYMid meet"` letterboxes it as needed. */}
      <div className="mt-4 aspect-video w-full lg:absolute lg:inset-0 lg:mt-0 lg:flex lg:aspect-auto lg:items-center lg:justify-center">
        <WeightRoomScene board={board} />
      </div>

      {/* The wall's text is unreadable below `lg`, so state the same board as page
          content there. From `lg` the wall carries it visually, but the wall is
          `aria-hidden`, so this stays available to screen readers. With no goals
          and no sets, the empty-state call to action above says all there is; after
          a failed read, the notice above does, rather than an empty board. */}
      {!showLoadError && (board.length > 0 || !showEmptyStateCta) ? (
        <TodayProgressPanel board={board} className="mx-4 my-6 lg:sr-only" />
      ) : null}

      <TodayRollover renderedDayKey={PACIFIC_CLOCK.today(now)} />
    </div>
  )
}
