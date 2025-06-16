'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

const COURT_X = 270
const COURT_Y = 60
const COURT_WIDTH = 1040
const COURT_HEIGHT = 835
const PLAYER_WIDTH = 80
const PLAYER_HEIGHT = 80

export function FreeRoamPlayer({ boundsRef }: { boundsRef: React.RefObject<SVGSVGElement> }) {
  const x = useMotionValue(600)
  const y = useMotionValue(600)

  const springX = useSpring(x, { stiffness: 50, damping: 10 })
  const springY = useSpring(y, { stiffness: 50, damping: 10 })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastMoveTime = useRef(Date.now())

  const [facingLeft, setFacingLeft] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isShootingPose, setIsShootingPose] = useState(false)

  const dribbleFrames = ['/sprites/LucasDribbling2.png', '/sprites/LucasDribbling3.png']
  const idleFrame = '/sprites/LucasIdle4.png'
  const shootingFrame = '/sprites/LucasShooting2.png'

  // WASD controls
  useEffect(() => {
    const speed = 8
    const keysPressed = new Set<string>()

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.add(e.key)

      let dx = 0
      let dy = 0

      if (keysPressed.has('w')) dy -= speed
      if (keysPressed.has('s')) dy += speed
      if (keysPressed.has('a')) dx -= speed
      if (keysPressed.has('d')) dx += speed

      if (dx !== 0 || dy !== 0) {
        lastMoveTime.current = Date.now()
        setIsShootingPose(false)
        setIsMoving(true)
      }

      if (dx !== 0) {
        setFacingLeft(dx < 0)
      }

      const svg = boundsRef.current
      if (!svg) return

      const bounds = svg.getBoundingClientRect()

      // Translate the viewBox coords (100,60,1400x880) into actual screen pixels
      const scaleX = bounds.width / 1600
      const scaleY = bounds.height / 1000

      const pxCOURT_X = COURT_X * scaleX
      const pxCOURT_Y = COURT_Y * scaleY
      const pxCOURT_WIDTH = COURT_WIDTH * scaleX
      const pxCOURT_HEIGHT = COURT_HEIGHT * scaleY

      const maxX = pxCOURT_X + pxCOURT_WIDTH - PLAYER_WIDTH
      const maxY = pxCOURT_Y + pxCOURT_HEIGHT - PLAYER_HEIGHT

      const nextX = Math.max(pxCOURT_X, Math.min(x.get() + dx, maxX))
      const nextY = Math.max(pxCOURT_Y, Math.min(y.get() + dy, maxY))

      x.set(nextX)
      y.set(nextY)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key)
      if (keysPressed.size === 0) {
        setIsMoving(false)
        lastMoveTime.current = Date.now()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [x, y])

  // Click-to-move
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const svg = boundsRef.current
      if (!svg) return

      const bounds = svg.getBoundingClientRect()

      // Step 1: get click position in screen pixels relative to the SVG
      const rawX = e.clientX - bounds.left
      const rawY = e.clientY - bounds.top

      // Step 2: scale COURT bounds to screen space
      const scaleX = bounds.width / 1600
      const scaleY = bounds.height / 1000

      const pxCOURT_X = COURT_X * scaleX
      const pxCOURT_Y = COURT_Y * scaleY
      const pxCOURT_WIDTH = COURT_WIDTH * scaleX
      const pxCOURT_HEIGHT = COURT_HEIGHT * scaleY

      const maxX = pxCOURT_X + pxCOURT_WIDTH - PLAYER_WIDTH
      const maxY = pxCOURT_Y + pxCOURT_HEIGHT - PLAYER_HEIGHT

      // Step 3: clamp to court area
      const clampedX = Math.max(pxCOURT_X, Math.min(rawX, maxX))
      const clampedY = Math.max(pxCOURT_Y, Math.min(rawY, maxY))

      if (clampedX !== x.get()) {
        setFacingLeft(clampedX < x.get())
      }

      lastMoveTime.current = Date.now()
      setIsShootingPose(false)
      setIsMoving(true)

      x.set(clampedX)
      y.set(clampedY)

      setTimeout(() => {
        setIsMoving(false)
        lastMoveTime.current = Date.now()
      }, 600)
    }

    const container = containerRef.current
    container?.addEventListener('click', handleClick)
    return () => container?.removeEventListener('click', handleClick)
  }, [x, y, boundsRef])

  // Walk cycle animation
  useEffect(() => {
    if (!isMoving) return

    const interval = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % dribbleFrames.length)
    }, 150)

    return () => clearInterval(interval)
  }, [isMoving])

  // Idle → shooting pose trigger
  useEffect(() => {
    const checkIdle = setInterval(() => {
      if (!isMoving && !isShootingPose) {
        const now = Date.now()
        const idleTime = now - lastMoveTime.current

        if (idleTime > 4000) {
          setIsShootingPose(true)

          setTimeout(() => {
            setIsShootingPose(false)
            lastMoveTime.current = Date.now()
          }, 1800)
        }
      }
    }, 1000)

    return () => clearInterval(checkIdle)
  }, [isMoving, isShootingPose])

  const currentSprite = isShootingPose
    ? shootingFrame
    : isMoving
      ? dribbleFrames[frameIndex]
      : idleFrame

  const shouldFlip = isShootingPose ? !facingLeft : facingLeft

  return (
    <div ref={containerRef} className="absolute w-full h-full">
      <motion.div
        className="absolute pointer-events-none z-50"
        style={{ x: springX, y: springY }}
        transition={{ type: 'spring' }}
      >
        <img
          src={currentSprite}
          className={`w-[80px] h-[80px] object-contain ${shouldFlip ? 'scale-x-[-1]' : ''}`}
          draggable={false}
        />
      </motion.div>
    </div>
  )
}
