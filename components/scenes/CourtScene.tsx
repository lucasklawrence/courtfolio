'use client'

import React, { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HomeBody } from '@/components/HomeBody'
import { TunnelHero } from '@/components/court/TunnelHero'
import { useSceneExperience } from '@/components/scene'

const FADE_DURATION = 1

/**
 * Court scene wrapper that preserves the intro flow before showing the court.
 */
export function CourtScene() {
  const { showIntro, markIntroSeen } = useSceneExperience()
  const [hasSeenIntroManually, setHasSeenIntroManually] = useState(false)

  const handleIntroEnd = useCallback(() => {
    setHasSeenIntroManually(true)
    markIntroSeen()
  }, [])

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
          className="w-screen h-screen"
        >
          <HomeBody />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
