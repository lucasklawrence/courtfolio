import React from 'react'

/**
 * Renders a classic locker placard label as an SVG.
 * Can be placed above or inside a locker zone.
 *
 * @param {string} label - The text to display on the placard.
 * @param {number} width - Optional width override.
 */
export function LockerPlacardSVG({ label, width = 120 }: { label: string; width?: number }) {
  const height = 30

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="4"
        ry="4"
        fill="#3b3b3b"
        stroke="#aaaaaa"
        strokeWidth="1.5"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="14"
        fontFamily="sans-serif"
        fontWeight="bold"
      >
        {label.toUpperCase()}
      </text>
    </svg>
  )
}
