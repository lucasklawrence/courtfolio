'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SpeechBubble } from './SpeechBubble'

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
}: {
  stepData: StepData
  svgRef: React.RefObject<SVGSVGElement | null>
}) {
  const prevX = useRef(stepData.x)
  const [facingLeft, setFacingLeft] = useState(false)

  const [scale, setScale] = useState(1)

  const isShortScreen = typeof window !== 'undefined' && window.innerHeight < 700;
  const yOffset = isShortScreen ? 50 : 0;

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
  const y = useMotionValue(screenY + yOffset);
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
      <SpeechBubble text={stepData.text} scale={scale} facingLeft={facingLeft}></SpeechBubble>
    </motion.div>
  )
}
