'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/** Court dimensions in SVG viewBox space */
const COURT_X = 270
const COURT_Y = 60
const COURT_WIDTH = 1040
const COURT_HEIGHT = 835

/** Rendered player sprite dimensions in screen pixels */
const PLAYER_WIDTH = 80
const PLAYER_HEIGHT = 80

/**
 * FreeRoamPlayer allows movement across an SVG-rendered court
 * via WASD or arrow keys, or by clicking a location to move there.
 * Movement is smoothed using Framer Motion springs and walk animations.
 *
 * @param boundsRef - Ref to the court's SVG element, used for bounding and scaling
 */
export function FreeRoamPlayer({ boundsRef }: { boundsRef: React.RefObject<SVGSVGElement> }) {
  // Reactive position state
  const x = useMotionValue(600)
  const y = useMotionValue(600)

  const springX = useSpring(x, { stiffness: 50, damping: 10 })
  const springY = useSpring(y, { stiffness: 50, damping: 10 })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const lastMoveTime = useRef(Date.now())

  // Animation state
  const [facingLeft, setFacingLeft] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isShootingPose, setIsShootingPose] = useState(false)

  // Sprites
  const dribbleFrames = ['/sprites/LucasDribbling2.png', '/sprites/LucasDribbling3.png']
  const idleFrame = '/sprites/LucasIdle4.png'
  const shootingFrame = '/sprites/LucasShooting2.png'

  /**
   * WASD + Arrow key movement support.
   * Applies bounds scaled to current SVG render size.
   */
  useEffect(() => {
    const speed = 8
    const keysPressed = new Set<string>()

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
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

      const bounds = svg.getBoundingClientRect()
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

  /**
   * Click-to-move interaction.
   * Uses screen-space clamped SVG bounds and animates at a slower pace.
   */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const svg = boundsRef.current
      if (!svg) return

      const bounds = svg.getBoundingClientRect()
      const rawX = e.clientX - bounds.left
      const rawY = e.clientY - bounds.top

      const scaleX = bounds.width / 1600
      const scaleY = bounds.height / 1000

      const pxCOURT_X = COURT_X * scaleX
      const pxCOURT_Y = COURT_Y * scaleY
      const pxCOURT_WIDTH = COURT_WIDTH * scaleX
      const pxCOURT_HEIGHT = COURT_HEIGHT * scaleY

      const maxX = pxCOURT_X + pxCOURT_WIDTH - PLAYER_WIDTH
      const maxY = pxCOURT_Y + pxCOURT_HEIGHT - PLAYER_HEIGHT

      const targetX = Math.max(pxCOURT_X, Math.min(rawX, maxX))
      const targetY = Math.max(pxCOURT_Y, Math.min(rawY, maxY))

      setFacingLeft(targetX < x.get())
      setIsShootingPose(false)
      setIsMoving(true)

      const speed = 2.5
      const threshold = 1.5

      let animationFrameId: number

      const step = () => {
        const dx = targetX - x.get()
        const dy = targetY - y.get()
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < threshold) {
          setIsMoving(false)
          cancelAnimationFrame(animationFrameId)
          return
        }

        const angle = Math.atan2(dy, dx)
        x.set(x.get() + Math.cos(angle) * speed)
        y.set(y.get() + Math.sin(angle) * speed)

        animationFrameId = requestAnimationFrame(step)
      }

      step()
      return () => cancelAnimationFrame(animationFrameId)
    }

    const container = containerRef.current
    container?.addEventListener('click', handleClick)
    return () => container?.removeEventListener('click', handleClick)
  }, [x, y, boundsRef])

  /**
   * Loop sprite walk frames when player is moving.
   */
  useEffect(() => {
    if (!isMoving) return

    const interval = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % dribbleFrames.length)
    }, 150)

    return () => clearInterval(interval)
  }, [isMoving])

  /**
   * Auto-switch to shooting pose after 4s of idle.
   */
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

  // Choose appropriate sprite based on animation state
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
