'use client'

import React, { useCallback } from 'react'

type FilmRoomSvgProps = {
  onZoneClick?: (zoneId: string) => void
  className?: string
  zoneContent?: Record<string, React.ReactNode>
}

/**
 * SVG layout for the Film Room.
 * Renders a stylized wall background with overlay zones for interactivity.
 */
export const FilmRoomSvg: React.FC<FilmRoomSvgProps> = ({
  onZoneClick,
  className,
  zoneContent = {},
}) => {
  const handleClick = useCallback(
    (zoneId: string) => {
      if (onZoneClick) onZoneClick(zoneId)
    },
    [onZoneClick]
  )

  return (
    <svg
      version="1.1"
      viewBox="0 0 1536 1024"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 🧱 Background wall */}
      <image
        href="/film-wall-texture.png" // or .png or .svg depending on final asset
        x="0"
        y="0"
        width="1536"
        height="1024"
        preserveAspectRatio="xMidYMid slice"
      />

      {/* 🧠 Overlay zone content */}
      {Object.entries(zoneContent).map(([zoneId, content]) => (
        <g key={zoneId} onClick={() => handleClick(zoneId)}>
          {content}
        </g>
      ))}
    </svg>
  )
}