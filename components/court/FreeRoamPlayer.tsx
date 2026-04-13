'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { clampToCourt, getScaledCourtBounds } from '@/utils/movements'
import { useCourtResizeClamp } from '@/utils/hooks/useCourtResizeClamp'
import { PLAYER_SIZE } from '@/constants/playerSize'

// Movement speeds in screen-space pixels per second
const KEYBOARD_SPEED = 280
const CLICK_SPEED = 180
const CLICK_THRESHOLD = 2

// Animation timing (ms)
const WALK_FRAME_MS = 150
const IDLE_TIMEOUT_MS = 4000
const SHOOT_POSE_MS = 1800

// Spring config — snappy enough to track keyboard, smooth enough for click-to-move
const SPRING_CONFIG = { stiffness: 170, damping: 22 }

const DRIBBLE_FRAMES = ['/sprites/LucasDribbling2.png', '/sprites/LucasDribbling3.png']
const IDLE_FRAME = '/sprites/LucasIdle4.png'
const SHOOTING_FRAME = '/sprites/LucasShooting2.png'

// Keys we care about (lowercased for comparison)
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

export function FreeRoamPlayer({
  boundsRef,
  target,
}: {
  boundsRef: React.RefObject<SVGSVGElement | null>
  target: { x: number; y: number } | null
}) {
  // Raw position values — the game loop writes to these
  const x = useMotionValue(400)
  const y = useMotionValue(400)

  // Springs follow the raw values and drive the DOM
  const springX = useSpring(x, SPRING_CONFIG)
  const springY = useSpring(y, SPRING_CONFIG)

  // Refs for input state (no re-renders needed)
  const keysRef = useRef(new Set<string>())
  const clickTargetRef = useRef<{ x: number; y: number } | null>(null)
  const lastMoveTimeRef = useRef(Date.now())
  const walkFrameTimeRef = useRef(0)
  const gameLoopRef = useRef(0)

  // Visual state (triggers re-renders for sprite changes)
  const [facingLeft, setFacingLeft] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isShootingPose, setIsShootingPose] = useState(false)
  const [scale, setScale] = useState(1)

  // Keep player clamped inside court on resize
  useCourtResizeClamp(boundsRef, x, y, PLAYER_SIZE, PLAYER_SIZE)

  // Recalculate sprite scale when viewport changes
  useEffect(() => {
    const svg = boundsRef.current
    if (!svg) return

    const updateScale = () => {
      const rawScale = svg.clientWidth / 1536
      setScale(Math.min(Math.max(rawScale, 0.5), 1))
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    window.addEventListener('orientationchange', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      window.removeEventListener('orientationchange', updateScale)
    }
  }, [boundsRef])

  // Sync click target prop into ref (keyboard will clear it, click will set it)
  useEffect(() => {
    if (!target) return
    clickTargetRef.current = target
  }, [target])

  // Keyboard input — only tracks which keys are held, movement happens in game loop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
      }
      const key = e.key.toLowerCase()
      if (MOVE_KEYS.has(key)) {
        keysRef.current.add(key)
        clickTargetRef.current = null // keyboard overrides click-to-move
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // ── Unified game loop ──────────────────────────────────────────────
  // Single RAF loop handles both keyboard and click-to-move with delta time,
  // so movement speed is consistent regardless of frame rate.
  useEffect(() => {
    let prevTime = performance.now()
    let wasMoving = false

    const tick = (now: number) => {
      const dt = Math.min((now - prevTime) / 1000, 0.1) // cap to prevent teleporting after tab-away
      prevTime = now

      const svg = boundsRef.current
      if (!svg) {
        gameLoopRef.current = requestAnimationFrame(tick)
        return
      }

      const bounds = getScaledCourtBounds(svg)
      const keys = keysRef.current
      let dx = 0
      let dy = 0
      let moved = false

      // ── Keyboard movement ──
      if (keys.has('w') || keys.has('arrowup')) dy -= 1
      if (keys.has('s') || keys.has('arrowdown')) dy += 1
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1
      if (keys.has('d') || keys.has('arrowright')) dx += 1

      if (dx !== 0 || dy !== 0) {
        // Normalize so diagonal isn't faster
        const len = Math.sqrt(dx * dx + dy * dy)
        dx = (dx / len) * KEYBOARD_SPEED * dt
        dy = (dy / len) * KEYBOARD_SPEED * dt

        const clamped = clampToCourt(x.get() + dx, y.get() + dy, bounds, PLAYER_SIZE, PLAYER_SIZE)
        x.set(clamped.x)
        y.set(clamped.y)
        moved = true

        if (dx < 0) setFacingLeft(true)
        else if (dx > 0) setFacingLeft(false)
      }
      // ── Click-to-move ──
      else if (clickTargetRef.current) {
        const tgt = clickTargetRef.current
        const clampedTarget = clampToCourt(tgt.x, tgt.y, bounds, PLAYER_SIZE, PLAYER_SIZE)
        const tdx = clampedTarget.x - x.get()
        const tdy = clampedTarget.y - y.get()
        const dist = Math.sqrt(tdx * tdx + tdy * tdy)

        if (dist < CLICK_THRESHOLD) {
          clickTargetRef.current = null
        } else {
          const step = Math.min(CLICK_SPEED * dt, dist) // don't overshoot
          const angle = Math.atan2(tdy, tdx)
          x.set(x.get() + Math.cos(angle) * step)
          y.set(y.get() + Math.sin(angle) * step)
          moved = true

          if (tdx < 0) setFacingLeft(true)
          else if (tdx > 0) setFacingLeft(false)
        }
      }

      // ── Update movement state ──
      if (moved !== wasMoving) {
        wasMoving = moved
        setIsMoving(moved)
        if (moved) setIsShootingPose(false)
      }

      if (moved) {
        lastMoveTimeRef.current = now

        // Walk cycle sprite swap
        if (now - walkFrameTimeRef.current > WALK_FRAME_MS) {
          setFrameIndex(prev => (prev + 1) % DRIBBLE_FRAMES.length)
          walkFrameTimeRef.current = now
        }
      }

      gameLoopRef.current = requestAnimationFrame(tick)
    }

    gameLoopRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(gameLoopRef.current)
  }, [boundsRef, x, y])

  // Idle shooting pose — triggers after player stands still for a while
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isMoving && !isShootingPose) {
        if (performance.now() - lastMoveTimeRef.current > IDLE_TIMEOUT_MS) {
          setIsShootingPose(true)
          setTimeout(() => {
            setIsShootingPose(false)
            lastMoveTimeRef.current = performance.now()
          }, SHOOT_POSE_MS)
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isMoving, isShootingPose])

  const currentSprite = isShootingPose
    ? SHOOTING_FRAME
    : isMoving
      ? DRIBBLE_FRAMES[frameIndex]
      : IDLE_FRAME

  const shouldFlip = isShootingPose ? !facingLeft : facingLeft

  return (
    <div className="absolute w-full h-full pointer-events-none">
      <motion.div
        className="absolute z-50 pointer-events-none"
        style={{
          x: springX,
          y: springY,
          scale,
          scaleX: shouldFlip ? -1 : 1,
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
