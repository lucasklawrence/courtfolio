'use client'

import { useEffect, useState, useMemo } from 'react'
import { Typewriter } from 'react-simple-typewriter'
import { FadeIn, FadeUp } from '@/components/motion/primitives'

/**
 * TunnelHero
 *
 * Displays the introductory hero animation with motion effects, typewriter text,
 * and a manual skip button. Automatically ends after a timeout.
 *
 * @component
 * @param {Object} props
 * @param {() => void} props.onIntroEnd - Callback to invoke when the intro completes or is skipped.
 *
 * @example
 * <TunnelHero onIntroEnd={() => setIntroDone(true)} />
 */
export function TunnelHero({ onIntroEnd }: { onIntroEnd: () => void }) {
  const [showTyping, setShowTyping] = useState(false)

  const TYPING_DELAY = 1000 // ms before typewriter starts
  const INTRO_TIMEOUT = 20000 // ms before auto-complete

  useEffect(() => {
    const typingTimeout = setTimeout(() => setShowTyping(true), TYPING_DELAY)
    const endTimeout = setTimeout(() => onIntroEnd(), INTRO_TIMEOUT)

    return () => {
      clearTimeout(typingTimeout)
      clearTimeout(endTimeout)
    }
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
        <FadeUp delay={0.4} duration={0.8} y={40}>
          <h1 className="text-4xl md:text-6xl font-extrabold">Lucas Lawrence</h1>
        </FadeUp>

        <FadeIn delay={0.9} duration={0.5}>
          <p className="text-lg md:text-2xl mt-4 text-orange-300 font-mono">
            {showTyping && (
              <Typewriter
                words={words}
                loop={1}
                cursor
                cursorStyle="|"
                typeSpeed={100}
                deleteSpeed={0}
                delaySpeed={1000}
              />
            )}
          </p>
        </FadeIn>

        <FadeIn delay={1.5}>
          <button
            onClick={onIntroEnd}
            className="inline-block mt-10 px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-orange-400 transition"
          >
            🏀 Step Onto the Court
          </button>
        </FadeIn>
      </div>
    </section>
  )
}
