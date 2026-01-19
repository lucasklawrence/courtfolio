'use client'

import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Actor, ActorType, Anchor, Play } from '@/features/court-plays/plays.schema'
import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'

type Props = {
  play: Play | null
  playToken: number
  resolveAnchor: (anchor: Anchor) => { x: number; y: number } | null
  reducedMotion: boolean
}

const BALL_RADIUS = 10
const ACTOR_SIZE = 26
const TOOLTIP_WIDTH = 360
const TOOLTIP_HEIGHT = 90
const TITLE_WIDTH = 220
const TITLE_HEIGHT = 34
const TOOLTIP_OFFSET_Y = 80
const LOOP_DELAY_MS = 600

const COLORS = {
  ballFill: '#f59e0b',
  ballStroke: '#fef3c7',
  oStroke: '#e2e8f0',
  xStroke: '#fb7185',
  coneFill: 'rgba(249, 115, 22, 0.25)',
  coneStroke: '#f97316',
  arrowStroke: '#e2e8f0',
  dimFill: 'rgba(5, 7, 13, 0.55)',
}

type SplitBurst = {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  durationMs: number
  ease?: string
}

function scaleDuration(ms: number, reducedMotion: boolean, minMs = 0) {
  if (!reducedMotion) return ms
  return Math.max(ms * 0.35, minMs)
}

function getPlayDurationMs(play: Play, reducedMotion: boolean) {
  return play.ball.steps.reduce((total, step) => {
    if (step.kind === 'split') {
      const longest = Math.max(
        0,
        ...step.branches.map(branch => scaleDuration(branch.durationMs, reducedMotion, 120))
      )
      return total + longest
    }
    if (step.kind === 'pause') {
      return total + scaleDuration(step.durationMs, reducedMotion)
    }
    if (step.kind === 'pulse') {
      return total + scaleDuration(step.durationMs, reducedMotion, 120)
    }
    return total + scaleDuration(step.durationMs, reducedMotion, 120)
  }, 0)
}

function ActorGlyph({ type }: { type: ActorType }) {
  const half = ACTOR_SIZE / 2

  if (type === 'O') {
    return <circle r={half} fill="none" stroke={COLORS.oStroke} strokeWidth={3} />
  }

  if (type === 'X') {
    return (
      <g stroke={COLORS.xStroke} strokeWidth={3} strokeLinecap="round">
        <line x1={-half} y1={-half} x2={half} y2={half} />
        <line x1={-half} y1={half} x2={half} y2={-half} />
      </g>
    )
  }

  if (type === 'CONE') {
    return (
      <polygon
        points={`0,${-half} ${half},${half} ${-half},${half}`}
        fill={COLORS.coneFill}
        stroke={COLORS.coneStroke}
        strokeWidth={2}
      />
    )
  }

  return (
    <path
      d="M -12 4 L 0 -10 L 12 4 M 0 -10 L 0 12"
      fill="none"
      stroke={COLORS.arrowStroke}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function resolveActorAnchor(
  actor: Actor,
  resolveAnchor: (anchor: Anchor) => { x: number; y: number } | null
) {
  return resolveAnchor(actor.at)
}

export function PlayRunner({ play, playToken, resolveAnchor, reducedMotion }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  const [splitBursts, setSplitBursts] = useState<SplitBurst[]>([])
  const [ripple, setRipple] = useState<{ id: string; x: number; y: number } | null>(null)
  const [loopToken, setLoopToken] = useState(0)
  const splitTimeoutsRef = useRef<number[]>([])
  const ballControls = useAnimation()
  const ballPositionRef = useRef<{ x: number; y: number } | null>(null)

  const playDurationMs = useMemo(
    () => (play ? getPlayDurationMs(play, reducedMotion) : 0),
    [play, reducedMotion]
  )

  useEffect(() => {
    if (!play) {
      setElapsedMs(0)
      return
    }

    let frameId = 0
    const start = performance.now()

    const tick = (now: number) => {
      setElapsedMs(now - start)
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [play, playToken, loopToken])

  useEffect(() => {
    setShowTooltip(false)
    if (!play) return
    const timeout = window.setTimeout(() => setShowTooltip(true), playDurationMs)
    return () => window.clearTimeout(timeout)
  }, [play, playToken, playDurationMs])

  useEffect(() => {
    setRipple(null)
    if (!play?.effects?.rippleAtMs) return

    const delay = scaleDuration(play.effects.rippleAtMs, reducedMotion)
    const timeout = window.setTimeout(() => {
      const fallback = resolveAnchor(play.ball.origin)
      const origin = ballPositionRef.current ?? fallback
      if (!origin) return
      const id = `${Date.now()}-ripple`
      setRipple({ id, x: origin.x, y: origin.y })
      window.setTimeout(() => {
        setRipple(current => (current?.id === id ? null : current))
      }, 700)
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [play, playToken, reducedMotion, resolveAnchor, loopToken])

  useEffect(() => {
    splitTimeoutsRef.current.forEach(timeout => window.clearTimeout(timeout))
    splitTimeoutsRef.current = []
    setSplitBursts([])

    if (!play) return

    let cancelled = false
    let loopTimeout: number | null = null

    const run = async () => {
      const origin = resolveAnchor(play.ball.origin)
      if (!origin) return

      ballControls.set({ x: origin.x, y: origin.y, scale: 1, opacity: 1 })
      ballPositionRef.current = origin

      for (const step of play.ball.steps) {
        if (cancelled) return

        if (step.kind === 'move') {
          const dest = resolveAnchor(step.to)
          if (!dest) continue
          const duration = scaleDuration(step.durationMs, reducedMotion, 120)
          await ballControls.start({
            x: dest.x,
            y: dest.y,
            transition: { duration: duration / 1000, ease: step.ease ?? 'easeInOut' },
          })
          ballPositionRef.current = dest
          continue
        }

        if (step.kind === 'pause') {
          const duration = scaleDuration(step.durationMs, reducedMotion)
          await new Promise(resolve => window.setTimeout(resolve, duration))
          continue
        }

        if (step.kind === 'pulse') {
          const duration = scaleDuration(step.durationMs, reducedMotion, 120)
          const half = duration / 2
          await ballControls.start({ scale: 1.25, transition: { duration: half / 1000 } })
          await ballControls.start({ scale: 1, transition: { duration: half / 1000 } })
          continue
        }

        if (step.kind === 'split') {
          const from = ballPositionRef.current ?? origin
          const [first, ...rest] = step.branches

          if (rest.length > 0) {
            const bursts: SplitBurst[] = rest
              .map(branch => {
                const to = resolveAnchor(branch.to)
                if (!to) return null
                return {
                  id: `${Date.now()}-${Math.random()}`,
                  from,
                  to,
                  durationMs: scaleDuration(branch.durationMs, reducedMotion, 120),
                  ease: branch.ease,
                }
              })
              .filter(Boolean) as SplitBurst[]

            setSplitBursts(prev => [...prev, ...bursts])
            bursts.forEach(burst => {
              const timeout = window.setTimeout(() => {
                setSplitBursts(prev => prev.filter(item => item.id !== burst.id))
              }, burst.durationMs + 200)
              splitTimeoutsRef.current.push(timeout)
            })
          }

          if (first) {
            const dest = resolveAnchor(first.to)
            if (!dest) continue
            const duration = scaleDuration(first.durationMs, reducedMotion, 120)
            await ballControls.start({
              x: dest.x,
              y: dest.y,
              transition: { duration: duration / 1000, ease: first.ease ?? 'easeOut' },
            })
            ballPositionRef.current = dest
          }
        }
      }

      if (cancelled) return
      const delay = scaleDuration(LOOP_DELAY_MS, reducedMotion, 120)
      loopTimeout = window.setTimeout(() => {
        if (!cancelled) {
          setLoopToken(prev => prev + 1)
        }
      }, delay)
    }

    run()

    return () => {
      cancelled = true
      if (loopTimeout) {
        window.clearTimeout(loopTimeout)
      }
      ballControls.stop()
    }
  }, [play, playToken, reducedMotion, resolveAnchor, ballControls, loopToken])

  const visibleActors = useMemo(() => {
    if (!play) return []
    const scale = reducedMotion ? 0.35 : 1
    return play.actors.filter(actor => {
      const enterAt = (actor.enterAtMs ?? 0) * scale
      const exitAt = actor.exitAtMs != null ? actor.exitAtMs * scale : Number.POSITIVE_INFINITY
      return elapsedMs >= enterAt && elapsedMs <= exitAt
    })
  }, [play, elapsedMs, reducedMotion])

  if (!play) return null

  const tooltipAnchor = resolveAnchor({ zoneId: 'anchor.playCallout' }) ?? { x: 1180, y: 390 }
  const tooltipX = tooltipAnchor.x - TOOLTIP_WIDTH / 2
  const tooltipY = tooltipAnchor.y - TOOLTIP_OFFSET_Y
  const titleX = tooltipAnchor.x - TITLE_WIDTH / 2
  const titleY = tooltipY - TITLE_HEIGHT - 10

  return (
    <>
      <div className="absolute inset-0 pointer-events-none z-10">
        <svg viewBox="0 0 1536 1024" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <AnimatePresence>
            {play.effects?.dimCourt && (
              <motion.rect
                key="dim"
                x={0}
                y={0}
                width={1536}
                height={1024}
                fill={COLORS.dimFill}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0.2 : 0.6 }}
              />
            )}
          </AnimatePresence>
          {ripple && (
            <motion.circle
              key={ripple.id}
              cx={ripple.x}
              cy={ripple.y}
              r={0}
              fill="transparent"
              stroke={COLORS.ballStroke}
              strokeWidth={2}
              initial={{ r: 0, opacity: 0.6 }}
              animate={{ r: 180, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.5 : 0.9, ease: 'easeOut' }}
            />
          )}
        </svg>
      </div>

      <div className="absolute inset-0 pointer-events-none z-20">
        <svg viewBox="0 0 1536 1024" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <AnimatePresence>
            {visibleActors.map(actor => {
              const anchor = resolveActorAnchor(actor, resolveAnchor)
              if (!anchor) return null
              return (
                <motion.g
                  key={actor.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0.1 : 0.3 }}
                  transform={`translate(${anchor.x} ${anchor.y})`}
                >
                  <ActorGlyph type={actor.type} />
                </motion.g>
              )
            })}
          </AnimatePresence>

          {splitBursts.map(burst => (
            <motion.g
              key={burst.id}
              initial={{ x: burst.from.x, y: burst.from.y, opacity: 0.8, scale: 0.9 }}
              animate={{ x: burst.to.x, y: burst.to.y, opacity: 0, scale: 0.9 }}
              transition={{
                duration: burst.durationMs / 1000,
                ease: burst.ease ?? 'easeOut',
              }}
            >
              <circle r={BALL_RADIUS * 0.8} fill={COLORS.ballFill} stroke={COLORS.ballStroke} />
            </motion.g>
          ))}

          <motion.g
            animate={ballControls}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            onUpdate={latest => {
              const x = Number(latest.x ?? 0)
              const y = Number(latest.y ?? 0)
              ballPositionRef.current = { x, y }
            }}
          >
            <circle r={BALL_RADIUS} fill={COLORS.ballFill} stroke={COLORS.ballStroke} strokeWidth={2} />
          </motion.g>
        </svg>
      </div>

      <div className="absolute inset-0 pointer-events-none z-40">
        <svg viewBox="0 0 1536 1024" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <foreignObject x={titleX} y={titleY} width={TITLE_WIDTH} height={TITLE_HEIGHT}>
            <SafeSvgHtml>
              <div className="flex h-full w-full items-center justify-center rounded-full border border-orange-200/40 bg-neutral-900/80 px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-100 shadow-lg">
                {play.title}
              </div>
            </SafeSvgHtml>
          </foreignObject>
        </svg>
      </div>

      <AnimatePresence>
        {showTooltip && (
          <div className="absolute inset-0 pointer-events-none z-40">
            <svg viewBox="0 0 1536 1024" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              <foreignObject x={tooltipX} y={tooltipY} width={TOOLTIP_WIDTH} height={TOOLTIP_HEIGHT}>
                <SafeSvgHtml>
                  <div className="h-full w-full rounded-xl border border-orange-200/40 bg-neutral-900/80 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
                    <div className="text-base">{play.tooltip.line1}</div>
                    <div className="text-sm text-orange-100/90">{play.tooltip.line2}</div>
                  </div>
                </SafeSvgHtml>
              </foreignObject>
            </svg>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
