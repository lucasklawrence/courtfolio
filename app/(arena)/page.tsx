'use client'

import { useState, useCallback } from 'react'
import { useHasSeenIntro } from '@/utils/useHasSeenIntro'
import { AnimatePresence, motion } from 'framer-motion'
import { HomeBody } from '@/components/HomeBody'
import { TunnelHero } from '@/components/court/TunnelHero'

/**
 * Duration of fade transitions in seconds for the intro and main content.
 */
const FADE_DURATION = 1

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

  const handleIntroEnd = useCallback(() => {
    setHasSeenIntroManually(true)
  }, [])

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
        {/* Replace with court-themed loading animation later */}
        <p>Loading court...</p>
      </div>
    )
  }

  const shouldShowIntro = showIntro && !hasSeenIntroManually
  const animateMainIn = showIntro && hasSeenIntroManually

  return (
    <AnimatePresence mode="wait">
      {shouldShowIntro ? (
        <motion.div
          key="intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_DURATION }}
          className="fixed inset-0 z-50"
        >
          <TunnelHero onIntroEnd={handleIntroEnd} />
        </motion.div>
      ) : (
        <motion.div
          key="main"
          initial={animateMainIn ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: FADE_DURATION }}
          className="absolute inset-0 z-10 pointer-events-none"
        >
          <HomeBody />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
