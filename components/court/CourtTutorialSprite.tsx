'use client'

import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { SpeechBubble } from '../SpeechBubble'
import { clampToCourt, getScaledCourtBounds } from '@/utils/movements'
import { PLAYER_SIZE } from '@/constants/playerSize'

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

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 120, damping: 14 })
  const springY = useSpring(y, { stiffness: 120, damping: 14 })

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

  // Update position (initial + on step change + on resize)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const updateScreenCoords = () => {
      const pt = svg.createSVGPoint()
      pt.x = stepData.x
      pt.y = stepData.y
      const ctm = svg.getScreenCTM()
      const screenPt = pt.matrixTransform(ctm ?? new DOMMatrix())

      const bounds = getScaledCourtBounds(svg)
      const playerSize = PLAYER_SIZE * scale

      const clamped = clampToCourt(
        screenPt.x,
        screenPt.y,
        bounds,
        playerSize,
        playerSize
      )

      x.set(clamped.x)
      y.set(clamped.y)
    }

    updateScreenCoords()
    window.addEventListener('resize', updateScreenCoords)
    window.addEventListener('orientationchange', updateScreenCoords)

    return () => {
      window.removeEventListener('resize', updateScreenCoords)
      window.removeEventListener('orientationchange', updateScreenCoords)
    }
  }, [stepData.x, stepData.y, svgRef, scale, x, y])

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
  }, [stepData.x, stepData.y])

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
          width: PLAYER_SIZE * scale,
          height: PLAYER_SIZE * scale,
          objectFit: 'contain',
          transform: `${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'}`,
        }}
        draggable={false}
      />
      <SpeechBubble text={stepData.text} scale={scale} facingLeft={facingLeft} />
    </motion.div>
  )
}
