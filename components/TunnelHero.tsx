'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Typewriter } from 'react-simple-typewriter'

type TunnelHeroProps = {
  onIntroEnd: () => void
}

export function TunnelHero({ onIntroEnd }: TunnelHeroProps) {
  useEffect(() => {
    const timeout = setTimeout(() => {
      onIntroEnd()
    }, 20000)

    return () => clearTimeout(timeout)
  }, [onIntroEnd])

  const words = useMemo(() => ['Writing code with court vision.'], [])

  return (
    <section className="relative h-screen w-full flex items-center justify-center bg-black text-white overflow-hidden">
      {/* Background visuals */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-900 to-black opacity-80" />
        <div className="absolute inset-0 bg-[url('/court.svg')] bg-cover opacity-10" />
        <div className="absolute w-96 h-96 bg-orange-500 blur-3xl opacity-30 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Foreground content */}
      <div className="z-10 text-center px-4">
        <motion.h1
          className="text-4xl md:text-6xl font-extrabold"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          Lucas Lawrence
        </motion.h1>

        <motion.p
          className="text-lg md:text-2xl mt-4 text-orange-300 font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
            <Typewriter
              words={words}
              loop={1}
              cursor
              cursorStyle="|"
              typeSpeed={100}
              deleteSpeed={0}
              delaySpeed={1000}
            />
        </motion.p>

        <motion.button
          onClick={onIntroEnd}
          className="inline-block mt-10 px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-orange-400 transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          🏀 Step Onto the Court
        </motion.button>
      </div>
    </section>
  )
}
