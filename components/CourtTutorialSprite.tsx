'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

type StepData = {
  x: number
  y: number
  img: string
  text: string
  facingLeft?: boolean
}

export function CourtTutorialSprite({
  stepData,
  svgRef,
  onNext,
  onSkip,
  onEnd,
}: {
  stepData: StepData
  svgRef: React.RefObject<SVGSVGElement | null>
  onNext: () => void
  onSkip: () => void
  onEnd?: (x: number, y: number) => void
}) {
  const prevX = useRef(stepData.x)
  const [facingLeft, setFacingLeft] = useState(false)

  const [scale, setScale] = useState(1)

useEffect(() => {
  const svg = svgRef.current
  if (!svg) return

  const updateScale = () => {
    const viewBoxWidth = 1600
    const pixelWidth = svg.clientWidth
    const rawScale = pixelWidth / viewBoxWidth

    // Cap scale between 0.5 and 1.0
    const clampedScale = Math.min(Math.max(rawScale, 0.5), 1)
    setScale(clampedScale)
  }

  updateScale()
  window.addEventListener('resize', updateScale)
  return () => window.removeEventListener('resize', updateScale)
}, [svgRef])

  const [screenX, screenY] = useMemo(() => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const pt = svg.createSVGPoint()
    pt.x = stepData.x
    pt.y = stepData.y
const ctm = svg.getScreenCTM()
const screenPt = pt.matrixTransform(ctm ?? new DOMMatrix())
    return [screenPt.x, screenPt.y]
  }, [stepData.x, stepData.y, svgRef.current])

  const x = useMotionValue(screenX)
  const y = useMotionValue(screenY)
  const springX = useSpring(x, { stiffness: 120, damping: 14 })
  const springY = useSpring(y, { stiffness: 120, damping: 14 })

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

    x.set(screenX)
    y.set(screenY)
  }, [stepData.x, stepData.y, screenX, screenY])

  return (
    <motion.div
      style={{ x: springX, y: springY }}
      className="absolute pointer-events-auto z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <img
  src={stepData.img}
  alt="Sprite"
  style={{
    width: 80 * scale,
    height: 80 * scale,
    objectFit: 'contain',
    transform: `${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'}`,
  }}
  draggable={false}
/>

     <div
  style={{
    position: 'absolute',
    top: 0,
    left: 90 * scale, // shift right of sprite
    width: 'max-content',
    maxWidth: 250,
  }}
>
  <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
<div className="bg-white text-black text-sm font-semibold px-2.5 py-2 rounded-xl shadow-lg border border-gray-200 relative">
<p className="text-sm sm:text-base leading-snug">{stepData.text}</p>
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
</div>

    </motion.div>
  )
}
