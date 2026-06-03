'use client'

import { useState, useCallback } from 'react'
import { useHasSeenIntro } from '@/utils/useHasSeenIntro'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { HomeBody } from '@/components/HomeBody'
import { TunnelHero } from '@/components/court/TunnelHero'

/**
 * Duration of fade transitions in seconds for the intro and main content.
 */
const FADE_DURATION = 1

/**
 * Vertical travel (px) for the intro→court hand-off. The intro slides up as it
 * fades out and the court rises into place, giving the swap a sense of
 * direction rather than a flat crossfade. Skipped entirely under reduced motion.
 */
const HANDOFF_SHIFT = 20

/**
 * Starting scale for the court's entrance. A near-1 value reads as a gentle
 * settle, not a zoom. `scale` is a compositor-only transform, so animating it
 * stays on the GPU and off the layout/paint path.
 */
const COURT_ENTER_SCALE = 0.98

/**
 * HomePage
 *
 * The main landing page for the site. If the user has not seen the intro,
 * it plays the `TunnelHero` animation. Once complete (or skipped), the
 * `HomeBody` is shown with court-based navigation and interactions.
 *
 * @returns {JSX.Element} The rendered home page component.
 */
export default function HomePage() {
  const { ready, showIntro } = useHasSeenIntro()
  const [hasSeenIntroManually, setHasSeenIntroManually] = useState(false)
  const reduce = useReducedMotion()

  const handleIntroEnd = useCallback(() => {
    setHasSeenIntroManually(true)
  }, [])

  if (!ready) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        {/* Replace with court-themed loading animation later */}
        <p>Loading court...</p>
      </div>
    )
  }

  const shouldShowIntro = showIntro && !hasSeenIntroManually
  const duration = reduce ? 0 : FADE_DURATION

  return (
    <AnimatePresence mode="wait">
      {shouldShowIntro ? (
        <m.div
          key="intro"
          initial={{ opacity: 1 }}
          // Slide up while fading out for a directional hand-off; reduced motion
          // keeps it in place so the swap is instant rather than animated.
          exit={reduce ? { opacity: 1 } : { opacity: 0, y: -HANDOFF_SHIFT }}
          transition={{ duration }}
        >
          <TunnelHero onIntroEnd={handleIntroEnd} />
        </m.div>
      ) : (
        <m.div
          key="main"
          data-testid="home-court-root"
          // Rise + settle into place as the court enters; reduced motion skips
          // the entrance entirely (`false`) so content appears immediately.
          initial={reduce ? false : { opacity: 0, y: HANDOFF_SHIFT, scale: COURT_ENTER_SCALE }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration }}
          className="w-screen h-screen"
        >
          <HomeBody />
        </m.div>
      )}
    </AnimatePresence>
  )
}
