'use client'

import React from 'react'

/**
 * CourtTitleSolo displays a single orange title, centered.
 *
 * Renders as `<h1>` so the home court view has a page-level heading once the
 * tunnel intro (which has its own `<h1>Lucas Lawrence</h1>`) has finished.
 */
export const CourtTitleSolo: React.FC<{
  title: string
}> = ({ title }) => {
  return (
    <div className="flex items-center justify-center text-center w-full h-full">
      <h1 className="text-orange-400 text-base sm:text-lg md:text-xl font-semibold leading-tight font-mono">
        {title}
      </h1>
    </div>
  )
}
