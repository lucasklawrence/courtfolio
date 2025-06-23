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

      {/* Optional zoom controls */}
      <div className="absolute bottom-16 right-6 z-50 flex flex-col gap-2 bg-white/80 p-2 rounded-md shadow-md">
        <button
          onClick={() => api.start({ scale: Math.min(scale.get() * 1.2, 3) })}
          className="bg-white/70 text-black px-3 py-1 rounded"
        >
          +
        </button>
        <button
          onClick={() => api.start({ scale: Math.max(scale.get() * 0.8, 0.5) })}
          className="bg-white/70 text-black px-3 py-1 rounded"
        >
          –
        </button>
        <button onClick={reset} className="bg-white/70 text-black px-3 py-1 rounded">
          Reset
        </button>
      </div>
    </div>
  )
}
