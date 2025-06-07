'use client'

import React from 'react'

/**
 * CourtTitle displays the main heading and subtitle centered above the court.
 *
 * @param title - The main name/title (e.g., "Lucas Lawrence")
 * @param subtitle - The subtitle below the main name (e.g., "Welcome to the Court")
 */
export const CourtTitle: React.FC<{
  title: string
  subtitle: string
}> = ({ title, subtitle }) => {
  return (
    <div
      className="absolute text-white text-4xl font-extrabold text-center z-10"
      style={{
        top: '6%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      {title}
      <br />
      <span className="text-orange-400 text-2xl font-mono">{subtitle}</span>
    </div>
  )
}
