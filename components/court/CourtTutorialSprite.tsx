'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { SpeechBubble } from '../SpeechBubble'
import { useWindowSize } from '@/utils/useWindowSize'

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
  const [screenX, setScreenX] = useState(0)
  const [screenY, setScreenY] = useState(0)

  const { width, height } = useWindowSize()
  const aspectRatio = width / height
  const isShortScreen = height < 700 || aspectRatio > 1.6
  const yOffset = isShortScreen ? 50 : 0

  // Scale calculation
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const updateScale = () => {
      const viewBoxWidth = 1600
      const pixelWidth = svg.clientWidth
      const rawScale = pixelWidth / viewBoxWidth
      const clampedScale = Math.min(Math.max(rawScale, 0.5), 1)
      setScale(clampedScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    window.addEventListener('orientationchange', updateScale)

    return () => {
      window.removeEventListener('resize', updateScale)
      window.removeEventListener('orientationchange', updateScale)
    }
  }, [svgRef])

  // Recalculate position on step change or resize
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const updateScreenCoords = () => {
      const pt = svg.createSVGPoint()
      pt.x = stepData.x
      pt.y = stepData.y
      const ctm = svg.getScreenCTM()
      const screenPt = pt.matrixTransform(ctm ?? new DOMMatrix())
      setScreenX(screenPt.x)
      setScreenY(screenPt.y)
    }

    updateScreenCoords()
    window.addEventListener('resize', updateScreenCoords)
    window.addEventListener('orientationchange', updateScreenCoords)

    return () => {
      window.removeEventListener('resize', updateScreenCoords)
      window.removeEventListener('orientationchange', updateScreenCoords)
    }
  }, [stepData.x, stepData.y, svgRef])

  const x = useMotionValue(screenX)
  const y = useMotionValue(screenY + yOffset)
  const springX = useSpring(x, { stiffness: 120, damping: 14 })
  const springY = useSpring(y, { stiffness: 120, damping: 14 })

  // Flip logic
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
    y.set(screenY + yOffset)
  }, [stepData.x, stepData.y, screenX, screenY, yOffset])

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
      <SpeechBubble text={stepData.text} scale={scale} facingLeft={facingLeft} />
    </motion.div>
  )
}
