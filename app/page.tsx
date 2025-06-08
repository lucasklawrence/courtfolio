'use client'

import { useState } from 'react'
import { useHasSeenIntro } from '@/utils/useHasSeenIntro'
import { TunnelHero } from '@/components/TunnelHero'
import { AnimatePresence, motion } from 'framer-motion'
import { HomeBody } from '@/components/HomeBody'

export default function HomePage() {
  const { ready, showIntro } = useHasSeenIntro()
  const [introDone, setIntroDone] = useState(false)

  if (!ready) return null // only AFTER all hooks have run

  return (
    <AnimatePresence mode="wait">
      {!introDone && showIntro ? (
        <motion.div
          key="intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        >
          <TunnelHero onIntroEnd={() => setIntroDone(true)} />
        </motion.div>
      ) : (
        <motion.div
          key="main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
           className="w-screen h-screen overflow-hidden"
        >
          <HomeBody />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
