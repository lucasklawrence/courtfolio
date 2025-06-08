'use client'

import React from 'react'

/**
 * CourtTitle displays the main heading and subtitle centered inside a foreignObject zone.
 */
export const CourtTitle: React.FC<{
  title: string
  subtitle: string
}> = ({ title, subtitle }) => {
  return (
    <div
      className="flex flex-col items-center justify-center text-center w-full h-full text-white"
    >
      <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-extrabold leading-tight">
        {title}
      </h1>
      <p className="text-orange-400 text-xs sm:text-sm md:text-base font-mono mt-1 leading-snug">
        {subtitle}
      </p>
    </div>
  )
}
