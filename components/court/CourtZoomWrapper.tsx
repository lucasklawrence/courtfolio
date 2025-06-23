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
      <div className="absolute bottom-16 right-4 z-50 flex flex-col gap-1 bg-white/80 p-1 rounded-md shadow-md text-xs md:text-base md:gap-2 md:p-2">
        <button
          onClick={() => api.start({ scale: Math.min(scale.get() * 1.2, 3) })}
          className="text-black px-2 py-1 rounded bg-white hover:bg-gray-200 ui-allow-click"
        >
          +
        </button>
        <button
          onClick={() => api.start({ scale: Math.max(scale.get() * 0.8, 0.5) })}
          className="text-black px-2 py-1 rounded bg-white hover:bg-gray-200 ui-allow-click"
        >
          –
        </button>
        <button
          onClick={reset}
          className="text-black px-2 py-1 rounded bg-white hover:bg-gray-200 ui-allow-click"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
