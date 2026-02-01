'use client'

import React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { motionTokens } from '@/constants/motion'
import type { CameraPreset } from './SceneTypes'

type CameraWrapperProps = {
  preset: CameraPreset
  isTransitioning: boolean
  onTransitionEnd?: () => void
  className?: string
  children: React.ReactNode
}

/**
 * Applies camera transforms (translate/scale/opacity/blur) to the scene content.
 */
export function CameraWrapper({
  preset,
  isTransitioning,
  onTransitionEnd,
  className,
  children,
}: CameraWrapperProps) {
  const prefersReducedMotion = useReducedMotion()

  const transition = prefersReducedMotion ? motionTokens.reduced : motionTokens.transition
  const blurAmount = prefersReducedMotion
    ? 0
    : isTransitioning
      ? motionTokens.blur.exiting
      : motionTokens.blur.entering

  return (
    <motion.div
      className={className ?? 'w-full h-full'}
      animate={{
        x: -preset.x,
        y: -preset.y,
        scale: preset.scale,
        opacity: preset.opacity ?? 1,
        filter: `blur(${blurAmount}px)`,
      }}
      transition={transition}
      style={{ transformOrigin: '0 0' }}
      onAnimationComplete={onTransitionEnd}
    >
      <div className="w-full h-full">{children}</div>
    </motion.div>
  )
}
