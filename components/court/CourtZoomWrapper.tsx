'use client'

import { useGesture } from '@use-gesture/react'
import { useSpring, animated } from '@react-spring/web'
import React, { useRef } from 'react'

export const CourtZoomWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const [{ x, y, scale }, api] = useSpring(() => ({ x: 0, y: 0, scale: 1 }))

  const bind = useGesture(
    {
      onPinch: ({ offset: [d], memo = scale.get() }) => {
        const newScale = Math.min(3, Math.max(0.5, memo * d))
        api.start({ scale: newScale })
        return memo
      },
      onDrag: ({ offset: [dx, dy] }) => {
        api.start({ x: dx, y: dy })
      },
      onWheel: ({ delta: [, dy] }) => {
        const newScale = Math.min(3, Math.max(0.5, scale.get() - dy * 0.001))
        api.start({ scale: newScale })
      },
    },
    {
      target: containerRef,
      pinch: { scaleBounds: { min: 0.5, max: 3 }, rubberband: true },
      drag: { from: () => [x.get(), y.get()], rubberband: true },
    }
  )

  const reset = () => {
    api.start({ x: 0, y: 0, scale: 1 })
  }

  return (
    <div className="relative w-full h-full overflow-hidden touch-none" ref={containerRef}>
      <animated.div
        style={{
          x,
          y,
          scale,
          touchAction: 'none',
        }}
        className="w-full h-full will-change-transform"
      >
        {children}
      </animated.div>
    </div>
  )
}
