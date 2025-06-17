'use client'

import React, { useEffect, useRef, useState } from 'react'

interface SpeechBubbleProps {
  text: string
  scale: number
  facingLeft?: boolean
  spriteWidth?: number
  children?: React.ReactNode
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  scale,
  facingLeft = false,
  spriteWidth = 80,
  children,
}) => {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [bubbleWidth, setBubbleWidth] = useState(0)

  useEffect(() => {
    if (bubbleRef.current) {
      const measured = bubbleRef.current.offsetWidth
      setBubbleWidth(measured * scale) // apply scale factor
    }
  }, [text, scale])

  const baseOffset = facingLeft ? spriteWidth * scale - 1 * spriteWidth : spriteWidth * scale
  const totalOffset = facingLeft ? -(bubbleWidth + baseOffset) : baseOffset

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: totalOffset,
        width: 'max-content',
        maxWidth: '100vw',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <div
          ref={bubbleRef}
          className="bg-white text-black text-base font-semibold px-4 py-2 rounded-xl shadow-lg border border-gray-200 relative max-w-[420px] sm:max-w-[480px] md:max-w-[520px]"
        >
          <p className="text-base leading-snug break-words">{text}</p>

          {/* arrow */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0 h-0"
            style={{
              left: facingLeft ? 'auto' : '-10px',
              right: facingLeft ? '-10px' : 'auto',
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: facingLeft ? '10px solid white' : 'none',
              borderRight: facingLeft ? 'none' : '10px solid white',
            }}
          />
        </div>

{children && (
  <div className="mt-2 flex gap-2 justify-end">
    <div className="flex gap-2">
      {children}
    </div>
  </div>
)}      </div>
    </div>
  )
}
