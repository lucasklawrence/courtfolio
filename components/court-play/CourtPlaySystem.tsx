'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useElementSize } from '@/utils/hooks/useElementSize'
import { COURT_VIEWBOX, COURT_ZONES, ANCHORS, CourtZone } from '@/features/court-plays/zones'
import { findZoneAtPoint, getZoneCenter } from '@/features/court-plays/utils'
import { resolvePlay } from '@/features/court-plays/resolvePlay'
import type { Anchor, Play } from '@/features/court-plays/plays.schema'
import { PlayRunner } from './PlayRunner'
import { ZoneLabels, getPlayTabletBounds } from './ZoneLabels'
import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'

type Props = {
  svgRef: React.RefObject<SVGSVGElement | null>
  playerPositionRef: React.RefObject<{ x: number; y: number } | null>
  movementEnabled: boolean
  clickFallbackEnabled?: boolean
  debugEnabled?: boolean
}

const HINT_WIDTH = 320
const HINT_HEIGHT = 48
const HINT_X = (COURT_VIEWBOX.width - HINT_WIDTH) / 2
const HINT_Y = 900

export function CourtPlaySystem({
  svgRef,
  playerPositionRef,
  movementEnabled,
  clickFallbackEnabled = true,
  debugEnabled,
}: Props) {
  const reducedMotion = useReducedMotion()
  const { width, height } = useElementSize(svgRef)

  const [runtimeDebug, setRuntimeDebug] = useState(false)
  const [activePrinciple, setActivePrinciple] = useState<string | null>(null)
  const [activeShot, setActiveShot] = useState<string | null>(null)
  const [activeContext, setActiveContext] = useState<string | null>(null)
  const [activePlay, setActivePlay] = useState<Play | null>(null)
  const [playToken, setPlayToken] = useState(0)
  const [playerAnchor, setPlayerAnchor] = useState<{ x: number; y: number } | null>(null)
  const [selectionNonce, setSelectionNonce] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [currentZoneId, setCurrentZoneId] = useState<string | null>(null)
  const [debugPosition, setDebugPosition] = useState<{ x: number; y: number } | null>(null)
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const [tabletOpen, setTabletOpen] = useState(false)

  const hintTimeoutRef = useRef<number | null>(null)
  const currentZoneRef = useRef<string | null>(null)
  const handleZoneEnterRef = useRef<(zone: CourtZone) => void>(() => {})
  const lastDebugUpdateRef = useRef(0)

  const isDebugEnabled = debugEnabled ?? runtimeDebug

  const zoneById = useMemo(() => new Map(COURT_ZONES.map(zone => [zone.id, zone])), [])
  const tabletBounds = useMemo(() => getPlayTabletBounds(COURT_ZONES), [])

  const tabletRect = useMemo(() => {
    if (width === 0 || height === 0) return null
    const scaleX = width / COURT_VIEWBOX.width
    const scaleY = height / COURT_VIEWBOX.height
    return {
      left: tabletBounds.x * scaleX,
      top: tabletBounds.y * scaleY,
      width: tabletBounds.width * scaleX,
      height: tabletBounds.height * scaleY,
    }
  }, [width, height, tabletBounds])

  const showHint = useCallback((message: string) => {
    setHint(message)
    if (hintTimeoutRef.current) {
      window.clearTimeout(hintTimeoutRef.current)
    }
    hintTimeoutRef.current = window.setTimeout(() => {
      setHint(null)
      hintTimeoutRef.current = null
    }, 2200)
  }, [])

  const cancelPlay = useCallback(() => {
    setActivePlay(null)
    setPlayToken(prev => prev + 1)
  }, [])

  const clearSelection = useCallback(
    (reason?: string) => {
      cancelPlay()
      setActivePrinciple(null)
      setActiveShot(null)
      setActiveContext(null)
      setSelectionNonce(prev => prev + 1)
      if (reason) {
        setLastEvent(reason)
      }
    },
    [cancelPlay]
  )

  const debugLog = useCallback(
    (message: string, payload?: Record<string, unknown>) => {
      if (!isDebugEnabled) return
      if (payload) {
        console.info(`[court-play] ${message}`, payload)
      } else {
        console.info(`[court-play] ${message}`)
      }
    },
    [isDebugEnabled]
  )

  const getPlayerAnchor = useCallback(() => {
    const position = playerPositionRef.current
    if (!position || width === 0 || height === 0) return null
    const scaleX = width / COURT_VIEWBOX.width
    const scaleY = height / COURT_VIEWBOX.height
    return { x: position.x / scaleX, y: position.y / scaleY }
  }, [playerPositionRef, width, height])

  const handleZoneEnter = useCallback(
    (zone: CourtZone) => {
      setSelectionNonce(prev => prev + 1)
      setCurrentZoneId(zone.id)
      setLastEvent(`enter:${zone.id}`)
      debugLog('zone-enter', { zoneId: zone.id, type: zone.type })

      if (zone.type === 'principle') {
        setActivePrinciple(zone.principleId ?? null)
        setActiveContext(null)
        cancelPlay()
        return
      }

      if (zone.type === 'shot') {
        if (!activePrinciple) {
          showHint('Select a principle before choosing a shot.')
          debugLog('shot-blocked', { zoneId: zone.id })
          return
        }
        setActiveShot(zone.shotId ?? null)
        cancelPlay()
        return
      }

      if (zone.type === 'context') {
        setActiveContext(zone.contextId ?? null)
        cancelPlay()
      }
    },
    [activePrinciple, cancelPlay, showHint, debugLog]
  )

  useEffect(() => {
    handleZoneEnterRef.current = handleZoneEnter
  }, [handleZoneEnter])

  useEffect(() => {
    if (debugEnabled !== undefined) return
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setRuntimeDebug(params.has('debugPlays'))
  }, [debugEnabled])

  useEffect(() => {
    if (!movementEnabled) return
    if (width === 0 || height === 0) return

    let frameId = 0

    const tick = () => {
      const position = playerPositionRef.current
      if (position) {
        const scaleX = width / COURT_VIEWBOX.width
        const scaleY = height / COURT_VIEWBOX.height
        const x = position.x / scaleX
        const y = position.y / scaleY
        const zone = findZoneAtPoint(COURT_ZONES, x, y)
        const zoneId = zone?.id ?? null
        const now = performance.now()

        if (isDebugEnabled && now - lastDebugUpdateRef.current > 200) {
          setDebugPosition({ x, y })
          lastDebugUpdateRef.current = now
        }

        if (zoneId !== currentZoneRef.current) {
          currentZoneRef.current = zoneId
          setCurrentZoneId(zoneId)
          if (zone) {
            handleZoneEnterRef.current(zone)
          } else {
            setLastEvent('leave:all')
          }
        }
      } else if (currentZoneRef.current !== null) {
        currentZoneRef.current = null
        setCurrentZoneId(null)
      }

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [movementEnabled, playerPositionRef, width, height])

  useEffect(() => {
    if (!activePrinciple || !activeShot) {
      setActivePlay(null)
      return
    }

    const resolved = resolvePlay(activePrinciple, activeShot, activeContext)
    if (!resolved) {
      showHint('No play mapped for that combo yet.')
      setActivePlay(null)
      debugLog('play-missing', { principle: activePrinciple, shot: activeShot })
      return
    }

    setPlayerAnchor(getPlayerAnchor())
    setActivePlay(resolved)
    setPlayToken(prev => prev + 1)
    debugLog('play-resolved', { playId: resolved.id })
  }, [
    activePrinciple,
    activeShot,
    activeContext,
    selectionNonce,
    getPlayerAnchor,
    showHint,
    debugLog,
  ])

  const resolveAnchor = useCallback(
    (anchor: Anchor) => {
      if ('x' in anchor) return anchor
      if (anchor.zoneId === 'anchor.player') {
        return playerAnchor ?? ANCHORS['anchor.player']
      }
      const anchorPoint = ANCHORS[anchor.zoneId]
      if (anchorPoint) return anchorPoint
      const zone = zoneById.get(anchor.zoneId)
      if (zone) return getZoneCenter(zone.bounds)
      return null
    },
    [playerAnchor, zoneById]
  )

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) {
        window.clearTimeout(hintTimeoutRef.current)
      }
    }
  }, [])

  const clickEnabled = clickFallbackEnabled && tabletOpen
  const debugZone = currentZoneId ?? 'none'
  const debugPlay = activePlay?.id ?? 'none'
  const debugPlayer =
    debugPosition ? `${Math.round(debugPosition.x)}, ${Math.round(debugPosition.y)}` : 'n/a'

  return (
    <>
      {tabletRect && (
        <div
          className="absolute z-30 pointer-events-auto"
          style={{
            left: tabletRect.left + tabletRect.width - 176,
            top: tabletRect.top + 6,
          }}
        >
          <button
            type="button"
            onClick={() =>
              setTabletOpen(prev => {
                const next = !prev
                if (!next) {
                  clearSelection('close:tablet')
                }
                return next
              })
            }
            className="pointer-events-auto w-44 rounded-full border border-orange-400/70 bg-neutral-900/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-200 shadow-lg transition hover:border-orange-300 hover:text-orange-100"
          >
            {tabletOpen ? 'Hide Play Tablet' : 'Open Play Tablet'}
          </button>
        </div>
      )}

      {tabletOpen && tabletRect && (
        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: tabletRect.left,
            top: tabletRect.top,
            width: tabletRect.width,
            height: tabletRect.height,
          }}
        >
          <ZoneLabels
            zones={COURT_ZONES}
            activePrinciple={activePrinciple}
            activeShot={activeShot}
            onZoneClick={clickEnabled ? handleZoneEnter : undefined}
            clickEnabled={clickEnabled}
            viewBox={`${tabletBounds.x} ${tabletBounds.y} ${tabletBounds.width} ${tabletBounds.height}`}
          />
        </div>
      )}

      <PlayRunner
        play={activePlay}
        playToken={playToken}
        resolveAnchor={resolveAnchor}
        reducedMotion={Boolean(reducedMotion)}
      />

      {hint && (
        <div className="absolute inset-0 pointer-events-none z-40">
          <svg viewBox="0 0 1536 1024" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
            <foreignObject x={HINT_X} y={HINT_Y} width={HINT_WIDTH} height={HINT_HEIGHT}>
              <SafeSvgHtml>
                <div className="flex h-full w-full items-center justify-center rounded-full border border-orange-200/40 bg-neutral-900/80 px-4 text-sm font-semibold text-orange-100 shadow-lg">
                  {hint}
                </div>
              </SafeSvgHtml>
            </foreignObject>
          </svg>
        </div>
      )}

      {isDebugEnabled && (
        <div className="absolute left-4 top-4 z-[70] pointer-events-none">
          <div className="rounded-lg border border-white/20 bg-black/70 px-3 py-2 text-[11px] font-mono text-white shadow-lg">
            <div>zone: {debugZone}</div>
            <div>active: {activePrinciple ?? 'none'} / {activeShot ?? 'none'}</div>
            <div>context: {activeContext ?? 'none'}</div>
            <div>play: {debugPlay}</div>
            <div>player: {debugPlayer}</div>
            <div>movement: {movementEnabled ? 'on' : 'off'} | click: {clickEnabled ? 'on' : 'off'}</div>
            <div>tablet: {tabletOpen ? 'open' : 'closed'}</div>
            <div>event: {lastEvent ?? 'none'}</div>
            {hint && <div>hint: {hint}</div>}
          </div>
        </div>
      )}
    </>
  )
}
