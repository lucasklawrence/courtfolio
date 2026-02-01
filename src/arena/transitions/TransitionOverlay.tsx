// TARGET PATH: src/arena/transitions/TransitionOverlay.tsx
'use client'

import React from 'react'
import type { TransitionVariantName } from './variants'

export type TransitionPhase = 'idle' | 'in' | 'out'

type TransitionOverlayProps = {
  phase: TransitionPhase
  inMs: number
  outMs: number
  inEase: number[]
  outEase: number[]
  className?: string
  variant?: TransitionVariantName
}

const toCubicBezier = (ease: number[]) => `cubic-bezier(${ease.join(',')})`

const getEffectStyle = (
  variant: TransitionVariantName,
  phase: TransitionPhase
): React.CSSProperties => {
  const isIdle = phase === 'idle'
  const base: React.CSSProperties = {
    opacity: isIdle ? 0 : 1,
  }

  switch (variant) {
    case 'tunnel':
      return {
        ...base,
        backgroundColor: '#000',
        WebkitMaskImage:
          'radial-gradient(circle at center, transparent 0%, transparent 35%, black 70%, black 100%)',
        maskImage:
          'radial-gradient(circle at center, transparent 0%, transparent 35%, black 70%, black 100%)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: phase === 'in' ? '70% 70%' : '140% 140%',
        maskSize: phase === 'in' ? '70% 70%' : '140% 140%',
        transform: phase === 'in' ? 'scale(1.05)' : 'scale(1)',
      }
    case 'ascent':
      return {
        ...base,
        backgroundColor: '#000',
        backgroundImage:
          'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 45%, rgba(0,0,0,0) 100%)',
        backgroundSize: '100% 200%',
        backgroundPosition: phase === 'in' ? '50% 0%' : '50% 100%',
        transform: phase === 'in' ? 'translateY(0%)' : 'translateY(-3%)',
      }
    case 'fold':
      return {
        ...base,
        backgroundColor: '#0b0b0b',
        backgroundImage:
          'linear-gradient(115deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 45%, rgba(0,0,0,0.35) 70%, rgba(0,0,0,0) 100%)',
        transformOrigin: 'left center',
        transform: phase === 'in' ? 'scaleX(1)' : 'scaleX(0.7)',
        clipPath:
          phase === 'in'
            ? 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)'
            : 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)',
      }
    case 'flash':
      return {
        ...base,
        backgroundColor: '#fff',
        backgroundImage:
          'radial-gradient(circle at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 45%, rgba(255,255,255,0) 100%)',
        transform: phase === 'in' ? 'scale(1)' : 'scale(1.15)',
        filter: phase === 'in' ? 'blur(0px)' : 'blur(10px)',
      }
    case 'fade':
    default:
      return {
        ...base,
        opacity: 0,
      }
  }
}

export function TransitionOverlay({
  phase,
  inMs,
  outMs,
  inEase,
  outEase,
  className,
  variant = 'fade',
}: TransitionOverlayProps) {
  const duration = phase === 'in' ? inMs : phase === 'out' ? outMs : 0
  const easing = phase === 'in' ? inEase : outEase
  const opacity = phase === 'in' ? 1 : 0
  const effectStyle = getEffectStyle(variant, phase)
  const transitionStyle: React.CSSProperties = {
    transitionProperty:
      'transform, opacity, background-position, background-size, filter, clip-path, mask-size, -webkit-mask-size',
    transitionDuration: `${Math.max(duration, 0)}ms`,
    transitionTimingFunction: toCubicBezier(easing),
    willChange: 'transform, opacity, background-position, background-size, filter',
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-40 overflow-hidden ${
        className ?? 'bg-black'
      }`}
      style={{
        opacity: phase === 'idle' ? 0 : opacity,
        transitionProperty: 'opacity',
        transitionDuration: `${Math.max(duration, 0)}ms`,
        transitionTimingFunction: toCubicBezier(easing),
      }}
    >
      <div className="absolute inset-0" style={{ ...transitionStyle, ...effectStyle }} />
    </div>
  )
}
