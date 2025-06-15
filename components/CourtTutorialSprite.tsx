'use client'

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'

type StepData = {
  x: number
  y: number
  img: string
  text: string
}

export function CourtTutorialSprite({
  stepData,
  onNext,
}: {
  stepData: StepData
  onNext: () => void
}) {
  // Motion values for sprite position
  const x = useMotionValue(stepData.x)
  const y = useMotionValue(stepData.y)

  // Smooth spring animation
  const springX = useSpring(x, { stiffness: 120, damping: 14 })
  const springY = useSpring(y, { stiffness: 120, damping: 14 })

  // Update position when stepData changes
  useEffect(() => {
    x.set(stepData.x)
    y.set(stepData.y)
  }, [stepData.x, stepData.y])

  return (
    <motion.div
      style={{
        x: springX,
        y: springY,
      }}
      className="absolute"
    >
      <img
        src={stepData.img}
        alt="Sprite"
        className="w-[80px] h-auto pointer-events-none"
      />

      {/* Speech Bubble */}
      <div className="relative -top-20 left-20 w-[180px]">
        <div className="bg-white text-black text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-gray-200 relative">
          <p>{stepData.text}</p>
          <div className="absolute left-[-10px] top-[30px] w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[10px] border-r-white" />
        </div>
        <button
          onClick={onNext}
          className="mt-2 ml-1 px-2 py-1 text-white bg-orange-600 rounded text-xs hover:bg-orange-700 transition"
        >
          →
        </button>
      </div>
    </motion.div>
  )
}
