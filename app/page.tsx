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
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white">
        {/* Replace with court-themed loading animation later */}
        <p>Loading court...</p>
      </div>
    )
  }

  const shouldShowIntro = showIntro && !hasSeenIntroManually

  return (
    <AnimatePresence mode="wait">
      {shouldShowIntro ? (
        <motion.div
          key="intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_DURATION }}
        >
          <TunnelHero onIntroEnd={handleIntroEnd} />
        </motion.div>
      ) : (
        <motion.div
          key="main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: FADE_DURATION }}
          className="w-screen h-screen overflow-hidden"
        >
          <HomeBody />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
