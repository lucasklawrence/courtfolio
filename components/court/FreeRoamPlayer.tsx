'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { clampToCourt, getScaledCourtBounds } from '@/utils/movements'
import { useCourtResizeClamp } from '@/utils/hooks/useCourtResizeClamp'
import { PLAYER_SIZE } from '@/constants/playerSize'
import { useMotionValueEvent } from 'framer-motion'

export function FreeRoamPlayer({
  boundsRef,
  target,
}: {
  boundsRef: React.RefObject<SVGSVGElement | null>
  target: { x: number; y: number } | null
}) {
  const x = useMotionValue(730)
  const y = useMotionValue(1340)
  const springX = useSpring(x, { stiffness: 50, damping: 10 })
  const springY = useSpring(y, { stiffness: 50, damping: 10 })

  const lastMoveTime = useRef(Date.now())
  const clickAnimationRef = useRef<number | null>(null)

  const [facingLeft, setFacingLeft] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isShootingPose, setIsShootingPose] = useState(false)
  const [scale, setScale] = useState(1)

  const dribbleFrames = ['/sprites/LucasDribbling2.png', '/sprites/LucasDribbling3.png']
  const idleFrame = '/sprites/LucasIdle4.png'
  const shootingFrame = '/sprites/LucasShooting2.png'

  // Resize clamp — keep player on court when resized
  useCourtResizeClamp(boundsRef, x, y, PLAYER_SIZE, PLAYER_SIZE)

  // Dynamic scale calculation
  useEffect(() => {
    const svg = boundsRef.current
    if (!svg) return

    const updateScale = () => {
      const viewBoxWidth = 1536
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
  }, [boundsRef])

  // Keyboard movement
  useEffect(() => {
    const speed = 8
    const keysPressed = new Set<string>()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
      }

      if (clickAnimationRef.current !== null) {
        cancelAnimationFrame(clickAnimationRef.current)
        clickAnimationRef.current = null
      }

      keysPressed.add(e.key)

      let dx = 0
      let dy = 0

      if (keysPressed.has('w') || keysPressed.has('ArrowUp')) dy -= speed
      if (keysPressed.has('s') || keysPressed.has('ArrowDown')) dy += speed
      if (keysPressed.has('a') || keysPressed.has('ArrowLeft')) dx -= speed
      if (keysPressed.has('d') || keysPressed.has('ArrowRight')) dx += speed

      if (dx !== 0 || dy !== 0) {
        lastMoveTime.current = Date.now()
        setIsShootingPose(false)
        setIsMoving(true)
        setFacingLeft(dx < 0)
      }

      const svg = boundsRef.current
      if (!svg) return

      const bounds = getScaledCourtBounds(svg)
      const { x: nextX, y: nextY } = clampToCourt(
        x.get() + dx,
        y.get() + dy,
        bounds,
        PLAYER_SIZE,
        PLAYER_SIZE
      )

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
  }, [x, y, boundsRef])

  // Click-to-move
  useEffect(() => {
    if (!target) return
    const svg = boundsRef.current
    if (!svg) return

    const bounds = getScaledCourtBounds(svg)
    const { x: targetX, y: targetY } = clampToCourt(
      target.x,
      target.y,
      bounds,
      PLAYER_SIZE,
      PLAYER_SIZE
    )

    setFacingLeft(targetX < x.get())
    setIsShootingPose(false)
    setIsMoving(true)

    const speed = 2.5
    const threshold = 1.5

    const step = () => {
      const dx = targetX - x.get()
      const dy = targetY - y.get()
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < threshold) {
        setIsMoving(false)
        if (clickAnimationRef.current !== null) {
          cancelAnimationFrame(clickAnimationRef.current)
          clickAnimationRef.current = null
        }
        return
      }

      const angle = Math.atan2(dy, dx)
      x.set(x.get() + Math.cos(angle) * speed)
      y.set(y.get() + Math.sin(angle) * speed)

      clickAnimationRef.current = requestAnimationFrame(step)
    }

    step()
  }, [target, x, y, boundsRef])

  const lastFrameTime = useRef(0)

  // Walk cycle
  useMotionValueEvent(x, 'change', () => {
    if (!isMoving) return

    const now = Date.now()
    if (now - lastFrameTime.current > 150) {
      setFrameIndex(prev => (prev + 1) % dribbleFrames.length)
      lastFrameTime.current = now
    }
  })

  // Idle shooting pose
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
    <div className="absolute w-full h-full pointer-events-none">
      <motion.div
        className="absolute z-50 pointer-events-none"
        animate={{
          x: x.get(),
          y: y.get(),
          scale: scale,
          scaleX: shouldFlip ? -1 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 50,
          damping: 10,
          scaleX: { duration: 0 }, // instant flip
        }}
      >
        <img
          src={currentSprite}
          style={{
            width: PLAYER_SIZE,
            height: PLAYER_SIZE,
            objectFit: 'contain',
          }}
          draggable={false}
        />
      </motion.div>
    </div>
  )
}
