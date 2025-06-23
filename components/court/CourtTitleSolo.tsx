'use client'

import React from 'react'

/**
 * CourtTitleSolo displays a single orange title, centered.
 */
export const CourtTitleSolo: React.FC<{
  title: string
}> = ({ title }) => {
  return (
    <div className="flex items-center justify-center text-center w-full h-full">
      <h2 className="text-orange-400 text-base sm:text-lg md:text-xl font-semibold leading-tight font-mono">
        {title}
      </h2>
    </div>
  )
}
