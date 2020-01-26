'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'

/**
 * SpeechBubble
 *
 * Renders a stylized speech bubble near a sprite. Supports directional tail,
 * dynamic scaling, and optional child controls (e.g., buttons).
 *
 * Position is computed based on the scaled sprite width and the bubble’s
 * own measured width.
 *
 * @component
 * @param {object} props
 * @param {string} props.text - The main text to display inside the speech bubble.
 * @param {number} props.scale - The scale factor applied to the bubble (used for zooming).
 * @param {boolean} [props.facingLeft=false] - If true, the tail points left and bubble aligns left of the sprite.
 * @param {number} [props.spriteWidth=80] - The pixel width of the sprite the bubble is attached to.
 * @param {React.ReactNode} [props.children] - Optional child elements rendered below the main text (e.g., buttons).
 * @returns {JSX.Element}
 *
 * @example
 * <SpeechBubble text="Welcome to the court!" scale={1.2}>
 *   <button>Next</button>
 * </SpeechBubble>
 */
export function SpeechBubble({
  text,
  scale,
  facingLeft = false,
  spriteWidth = 80,
  children,
}: {
  text: string
  scale: number
  facingLeft?: boolean
  spriteWidth?: number
  children?: React.ReactNode
}) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [bubbleWidth, setBubbleWidth] = useState(0)

  useLayoutEffect(() => {
    if (bubbleRef.current) {
      const measured = bubbleRef.current.offsetWidth
      setBubbleWidth(measured)
    }
  }, [text])

  const spriteOffset = spriteWidth * scale
  const bubbleOffset = facingLeft ? -(bubbleWidth * scale + spriteOffset) : spriteOffset

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: bubbleOffset,
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

          {/* Tail */}
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
            <div className="flex gap-2">{children}</div>
          </div>
        )}
      </div>
    </div>
  )
}
