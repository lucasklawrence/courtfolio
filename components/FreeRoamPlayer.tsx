'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

const COURT_WIDTH = 1600
const COURT_HEIGHT = 1000
const PLAYER_WIDTH = 80
const PLAYER_HEIGHT = 80

export function FreeRoamPlayer() {
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

      const nextX = Math.max(0, Math.min(x.get() + dx, COURT_WIDTH - PLAYER_WIDTH))
      const nextY = Math.max(0, Math.min(y.get() + dy, COURT_HEIGHT - PLAYER_HEIGHT))

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
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newX = e.clientX - rect.left
      const newY = e.clientY - rect.top

      const clampedX = Math.max(0, Math.min(newX, COURT_WIDTH - PLAYER_WIDTH))
      const clampedY = Math.max(0, Math.min(newY, COURT_HEIGHT - PLAYER_HEIGHT))

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
  }, [x, y])

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

  let shouldFlip = facingLeft
  if (isShootingPose) {
    shouldFlip = !shouldFlip
  }
  return (
    <div ref={containerRef} className="absolute w-full h-full">
      <motion.div
        className="absolute pointer-events-none z-50"
        style={{ x: springX, y: springY }}
        transition={{ type: 'spring' }}
      >
        <img
          src={currentSprite}
          className={`w-[80px] h-[80-px] object-contain ${shouldFlip ? 'scale-x-[-1]' : ''}`}
          draggable={false}
        />
      </motion.div>
    </div>
  )
}
