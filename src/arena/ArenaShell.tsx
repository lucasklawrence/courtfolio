// TARGET PATH: src/arena/ArenaShell.tsx
'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SvgLayoutContainer } from '@/components/common/SvgLayoutContainer'
import { CourtSvg } from '@/components/court/CourtSvg'
import { PreferencesProvider, useUserPrefs } from '../prefs/PreferencesProvider'
import { getMotionScale } from '../motion/scale'
import { CoachClipboard } from '../ui/CoachClipboard'
import {
  defaultTransition,
  transitionRecipes,
  type TransitionKind,
  type TransitionRecipe,
} from '../motion/recipes'
import { TransitionOverlay, type TransitionPhase } from './transitions/TransitionOverlay'
import { transitionVariants, type TransitionVariantName } from './transitions/variants'

type ArenaNavContextValue = {
  navigate: (to: string) => void
}

type CourtContent = {
  zoneContent?: Record<string, React.ReactNode>
  ripples?: { id: number; x: number; y: number }[]
  onZoneClick?: (zoneId: string) => void
}

type ArenaCourtContextValue = {
  svgRef: React.RefObject<SVGSVGElement | null>
  setCourtContent: (content: CourtContent) => void
  clearCourtContent: () => void
}

type OverlayState = {
  phase: TransitionPhase
  inMs: number
  outMs: number
  inEase: number[]
  outEase: number[]
  variant: TransitionVariantName
}

type PendingNavigation = {
  to: string
  overlay: OverlayState
}

const ArenaNavContext = createContext<ArenaNavContextValue | null>(null)
const ArenaCourtContext = createContext<ArenaCourtContextValue | null>(null)

const ROOM_PATHS = {
  court: '/',
  locker: '/locker-room',
  rafters: '/banners',
  binder: '/projects',
  office: '/contact',
} as const

const resolveTransitionKind = (to: string): TransitionKind | null => {
  if (to === ROOM_PATHS.court) return 'to-court'
  if (to.startsWith(ROOM_PATHS.locker)) return 'to-locker'
  if (to.startsWith(ROOM_PATHS.rafters)) return 'to-rafters'
  if (to.startsWith(ROOM_PATHS.binder)) return 'to-binder'
  if (to.startsWith(ROOM_PATHS.office)) return 'to-office'
  return null
}

const toOverlayState = (recipe: TransitionRecipe): OverlayState => ({
  phase: 'idle',
  inMs: 0,
  outMs: 0,
  inEase: recipe.out.ease,
  outEase: recipe.in.ease,
  variant: 'fade',
})

const resolveOverlayVariant = (kind: TransitionKind | null): TransitionVariantName => {
  switch (kind) {
    case 'to-locker':
      return 'tunnel'
    case 'to-rafters':
      return 'ascent'
    case 'to-binder':
      return 'fold'
    case 'to-office':
      return 'flash'
    case 'to-court':
    default:
      return 'fade'
  }
}

export function useArenaNav() {
  return useContext(ArenaNavContext)
}

export function useArenaCourt() {
  const context = useContext(ArenaCourtContext)
  if (!context) {
    throw new Error('useArenaCourt must be used within ArenaShell')
  }
  return context
}

function ArenaShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { prefs } = useUserPrefs()
  const transitioning = useRef(false)
  const courtRef = useRef<SVGSVGElement | null>(null)
  const [courtContent, setCourtContentState] = useState<CourtContent | null>(null)
  const pendingNavigation = useRef<PendingNavigation | null>(null)
  const popstateTransition = useRef<PendingNavigation | null>(null)
  const visitedRooms = useRef<Set<string>>(new Set())
  const prevPathname = useRef<string | null>(null)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const [overlay, setOverlay] = useState<OverlayState>(toOverlayState(defaultTransition))

  const isCourtRoute = pathname === ROOM_PATHS.court

  const setCourtContent = useCallback((content: CourtContent) => {
    setCourtContentState(content)
  }, [])

  const clearCourtContent = useCallback(() => {
    setCourtContentState(null)
  }, [])

  const courtContextValue = useMemo(
    () => ({
      svgRef: courtRef,
      setCourtContent,
      clearCourtContent,
    }),
    [setCourtContent, clearCourtContent]
  )

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const scale = getMotionScale(prefs.motion, prefersReducedMotion)
  const overlayVariant = transitionVariants[overlay.variant] ?? transitionVariants.fade

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      const target = window.location.pathname
      if (!prevPathname.current || prevPathname.current === target) {
        return
      }
      const kind = resolveTransitionKind(target)
      const recipe = kind ? transitionRecipes[kind] ?? defaultTransition : defaultTransition
      const variant = resolveOverlayVariant(kind)
      const isFirstVisit = !visitedRooms.current.has(target)
      const visitScale = isFirstVisit ? 1 : 0.6
      const scaled = scale * visitScale * 0.6
      const inMs = Math.round(recipe.out.duration * scaled * 1000)
      const outMs = Math.round(recipe.in.duration * scaled * 1000)

      if (scaled <= 0 || (inMs === 0 && outMs === 0)) {
        setOverlay(prev => (prev.phase === 'idle' ? prev : { ...prev, phase: 'idle' }))
        popstateTransition.current = null
        transitioning.current = false
        return
      }

      clearTimers()
      transitioning.current = true

      const nextOverlay: OverlayState = {
        phase: 'in',
        inMs,
        outMs,
        inEase: recipe.out.ease,
        outEase: recipe.in.ease,
        variant,
      }

      popstateTransition.current = { to: target, overlay: nextOverlay }
      setOverlay(nextOverlay)

      timers.current.push(
        setTimeout(() => {
          setOverlay(prev => ({ ...prev, phase: 'out' }))
        }, inMs)
      )

      timers.current.push(
        setTimeout(() => {
          setOverlay(prev => ({ ...prev, phase: 'idle' }))
          popstateTransition.current = null
          transitioning.current = false
        }, inMs + outMs)
      )
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [clearTimers, scale])

  const navigate = useCallback(
    (to: string) => {
      if (transitioning.current || to === pathname) return

      const kind = resolveTransitionKind(to)
      const recipe = kind ? transitionRecipes[kind] ?? defaultTransition : defaultTransition
      const variant = resolveOverlayVariant(kind)
      const isFirstVisit = !visitedRooms.current.has(to)
      const visitScale = isFirstVisit ? 1 : 0.6
      const scaled = scale * visitScale
      const inMs = Math.round(recipe.out.duration * scaled * 1000)
      const outMs = Math.round(recipe.in.duration * scaled * 1000)

      transitioning.current = true
      clearTimers()
      pendingNavigation.current = null

      if (scaled <= 0 || (inMs === 0 && outMs === 0)) {
        setOverlay(prev => (prev.phase === 'idle' ? prev : { ...prev, phase: 'idle' }))
        router.push(to)
        return
      }

      const nextOverlay: OverlayState = {
        phase: 'in',
        inMs,
        outMs,
        inEase: recipe.out.ease,
        outEase: recipe.in.ease,
        variant,
      }

      setOverlay(nextOverlay)
      pendingNavigation.current = { to, overlay: nextOverlay }
      timers.current.push(
        setTimeout(() => {
          router.push(to)
        }, inMs)
      )
    },
    [pathname, router, scale, clearTimers]
  )

  const navContextValue = useMemo(() => ({ navigate }), [navigate])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  useEffect(() => {
    if (!pathname) return
    if (!prevPathname.current) {
      prevPathname.current = pathname
      visitedRooms.current.add(pathname)
      return
    }

    if (prevPathname.current === pathname) return

    prevPathname.current = pathname
    visitedRooms.current.add(pathname)
    const popstate = popstateTransition.current
    if (popstate && popstate.to === pathname) {
      return
    }

    transitioning.current = false
    clearTimers()

    const pending = pendingNavigation.current
    if (pending) {
      pendingNavigation.current = null
      if (pending.to === pathname) {
        if (pending.overlay.outMs <= 0) {
          setOverlay({ ...pending.overlay, phase: 'idle' })
          return
        }

        setOverlay({ ...pending.overlay, phase: 'out' })
        timers.current.push(
          setTimeout(() => {
            setOverlay(prev => ({ ...prev, phase: 'idle' }))
          }, pending.overlay.outMs)
        )
        return
      }
    }

    setOverlay(prev => (prev.phase === 'idle' ? prev : { ...prev, phase: 'idle' }))
  }, [pathname, clearTimers])

  return (
    <ArenaNavContext.Provider value={navContextValue}>
      <ArenaCourtContext.Provider value={courtContextValue}>
        <div className="relative min-h-screen">
          {!isCourtRoute && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-5"
            >
              <div className="w-[min(100vw,calc(100vh*1.5))] aspect-[3/2]">
                <CourtSvg />
              </div>
            </div>
          )}
          <div className="relative z-10">
            {isCourtRoute ? (
              <SvgLayoutContainer>
                <CourtSvg
                  ref={courtRef}
                  zoneContent={courtContent?.zoneContent}
                  onZoneClick={courtContent?.onZoneClick}
                  ripples={courtContent?.ripples}
                />
                {children}
              </SvgLayoutContainer>
            ) : (
              children
            )}
          </div>
          <TransitionOverlay
            phase={overlay.phase}
            inMs={overlay.inMs}
            outMs={overlay.outMs}
            inEase={overlay.inEase}
            outEase={overlay.outEase}
            className={overlayVariant.overlayClassName}
            variant={overlay.variant}
          />
          <CoachClipboard />
        </div>
      </ArenaCourtContext.Provider>
    </ArenaNavContext.Provider>
  )
}

export function ArenaShell({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <ArenaShellInner>{children}</ArenaShellInner>
    </PreferencesProvider>
  )
}
