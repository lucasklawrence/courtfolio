'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type StepData = {
  x: number
  y: number
  img: string
  text: string
  facingLeft?: boolean
}

export function CourtTutorialSprite({
  stepData,
  onNext,
  onSkip,
  onEnd,
}: {
  stepData: StepData
  onNext: () => void
  onSkip: () => void
  onEnd?: (x: number, y: number) => void // optional if you use free roam transition
}) {
  const x = useMotionValue(stepData.x)
  const y = useMotionValue(stepData.y)
  const springX = useSpring(x, { stiffness: 120, damping: 14 })
  const springY = useSpring(y, { stiffness: 120, damping: 14 })

  const prevX = useRef(stepData.x)
  const [facingLeft, setFacingLeft] = useState(false)

  useEffect(() => {
    if (typeof stepData.facingLeft === 'boolean') {
      setFacingLeft(stepData.facingLeft)
    } else {
      if (stepData.x < prevX.current) {
        setFacingLeft(true)
      } else if (stepData.x > prevX.current) {
        setFacingLeft(false)
      }
    }
    prevX.current = stepData.x

    x.set(stepData.x)
    y.set(stepData.y)
  }, [stepData.x, stepData.y])

  return (
    <motion.div
      style={{ x: springX, y: springY }}
      className="absolute"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <img
        src={stepData.img}
        alt="Sprite"
        className={`w-[80px] h-auto ${facingLeft ? 'scale-x-[-1]' : ''}`}
      />

      <div className="relative -top-20 left-20 w-[180px]">
        <div className="bg-white text-black text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-gray-200 relative">
          <p>{stepData.text}</p>
          <div className="absolute left-[-10px] top-[30px] w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[10px] border-r-white" />
        </div>

        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              if (onEnd) onEnd(stepData.x, stepData.y)
              onNext()
            }}
            className="px-2 py-1 text-white bg-orange-600 rounded text-xs hover:bg-orange-700 transition"
          >
            →
          </button>
          <button
            onClick={() => {
              if (onEnd) onEnd(stepData.x, stepData.y)
              onSkip()
            }}
            className="px-2 py-1 text-xs bg-gray-300 text-gray-800 rounded hover:bg-gray-200 transition"
          >
            Skip
          </button>
        </div>
      </div>
    </motion.div>
  )
}
