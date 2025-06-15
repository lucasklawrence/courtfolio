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
  const [facingLeft, setFacingLeft] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)

  const spriteFrames = [
    '/sprites/LucasDribbling2.png',
    '/sprites/LucasDribbling3.png',
  ]

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
      if (keysPressed.has('a')) {
        dx -= speed
        setFacingLeft(true)
      }
      if (keysPressed.has('d')) {
        dx += speed
        setFacingLeft(false)
      }

      const nextX = Math.max(0, Math.min(x.get() + dx, COURT_WIDTH - PLAYER_WIDTH))
      const nextY = Math.max(0, Math.min(y.get() + dy, COURT_HEIGHT - PLAYER_HEIGHT))

      if (dx !== 0 || dy !== 0) setIsMoving(true)

      x.set(nextX)
      y.set(nextY)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key)
      if (keysPressed.size === 0) setIsMoving(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [x, y])

  // click-to-move
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newX = e.clientX - rect.left
      const newY = e.clientY - rect.top

      const clampedX = Math.max(0, Math.min(newX, COURT_WIDTH - PLAYER_WIDTH))
      const clampedY = Math.max(0, Math.min(newY, COURT_HEIGHT - PLAYER_HEIGHT))

      if (clampedX < x.get()) setFacingLeft(true)
      else setFacingLeft(false)

      setIsMoving(true)
      x.set(clampedX)
      y.set(clampedY)

      // Stop movement after a delay
      setTimeout(() => setIsMoving(false), 600)
    }

    const container = containerRef.current
    container?.addEventListener('click', handleClick)
    return () => container?.removeEventListener('click', handleClick)
  }, [x, y])

  // Walk cycle animation
  useEffect(() => {
    if (!isMoving) return

    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % spriteFrames.length)
    }, 150)

    return () => clearInterval(interval)
  }, [isMoving])

  return (
    <div ref={containerRef} className="absolute w-full h-full">
      <motion.div
        className="absolute pointer-events-none z-50"
        style={{ x: springX, y: springY }}
        transition={{ type: 'spring' }}
      >
        <img
          src={spriteFrames[frameIndex]}
          className={`w-[80px] h-auto ${facingLeft ? 'scale-x-[-1]' : ''}`}
          draggable={false}
        />
      </motion.div>
    </div>
  )
}
