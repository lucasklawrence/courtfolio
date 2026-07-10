import type { PanelResult } from '@/lib/panel/types'
import { DraftRoomHeader } from './DraftRoomHeader'
import { DraftRoomBody } from './DraftRoomBody'

/** Props for {@link DraftRoom}. */
interface DraftRoomProps {
  /** The stored panel result to replay. */
  result: PanelResult
  /** Whether the result is hand-authored illustrative data (drives the badge). */
  illustrative: boolean
}

/**
 * The Draft Room showcase: replays a stored {@link PanelResult} so the panel's
 * deliberation reads top-to-bottom — personas first (independently), then the
 * agreement/disagreement map, then the meta-judge's synthesis.
 *
 * It's a *replay*, not a live run: the result is pre-baked, so the page costs
 * nothing to visit and exposes no paid endpoint. Honest about that via the
 * illustrative badge until a real run replaces the data. (The live mode is a
 * separate island — `LiveDraftRoom` — mounted only behind its own flag, #241.)
 *
 * Sections fade up on scroll via the native `.reveal` class (CSS scroll-driven,
 * off the main thread) — which degrades to fully-visible where unsupported or
 * under reduced-motion, so content is never left hidden behind JS. This is a
 * server component; no client JS is needed to render the showcase.
 */
export function DraftRoom({ result, illustrative }: DraftRoomProps) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6">
      <DraftRoomHeader thesis={result.thesis} illustrative={illustrative} />
      <DraftRoomBody result={result} />
    </div>
  )
}
