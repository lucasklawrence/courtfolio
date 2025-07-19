'use client'

import clsx from 'clsx'
import React from 'react'

export type SectionContainerProps = {
  /** Optional additional class names */
  className?: string
  /** Section content to render inside the container */
  children: React.ReactNode
}

/**
 * A reusable layout wrapper that constrains width, applies padding,
 * and ensures consistent alignment across all full-width sections.
 *
 * Used throughout the site (e.g., binder, locker room, banner wall) to keep content visually aligned.
 *
 * @component
 * @param {SectionContainerProps} props
 * @returns {JSX.Element}
 */
export const SectionContainer = ({ children, className = '' }: SectionContainerProps) => {
  return (
    <div className={clsx('mx-auto w-full max-w-[1600px] px-2 sm:px-4', className)}>
      {children}
    </div>
  )
}