import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { DraftRoom } from '@/components/draft-room/DraftRoom'
import { isDraftRoomEnabled } from '@/lib/feature-flags'
import { courtfolioPanelResult, PANEL_RESULT_IS_ILLUSTRATIVE } from './panelResult'

/** Page metadata for the Draft Room showcase. */
export const metadata: Metadata = {
  title: 'The Draft Room — Court Vision',
  description:
    'A multi-persona LLM judge panel grades Courtfolio as a prospect: independent verdicts, an agreement/disagreement map, and a meta-judge synthesis.',
}

/**
 * The Draft Room route (#234 Phase 2 / #241) — the public surface of the judge
 * panel. A pre-baked showcase: it replays a stored {@link courtfolioPanelResult}
 * with an animated reveal, so the page makes no model calls and costs nothing to
 * visit. The arena gradient + spotlight match the rest of the portfolio.
 */
export default function DraftRoomPage() {
  // Feature-gated like the Training Facility: 404s until the flag is on (live
  // data swapped in + nav wired). See lib/feature-flags.ts.
  if (!isDraftRoomEnabled()) notFound()

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-black via-neutral-900 to-black text-white">
      {/* Orange spotlight wash behind the content — purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(circle_at_50%_0%,rgba(249,115,22,0.18),rgba(0,0,0,0)_60%)]"
      />
      <div className="relative">
        <DraftRoom result={courtfolioPanelResult} illustrative={PANEL_RESULT_IS_ILLUSTRATIVE} />
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <BackToCourtButton />
        </div>
      </div>
    </main>
  )
}
