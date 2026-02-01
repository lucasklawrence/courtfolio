'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { motionTokens } from '@/constants/motion'
import { CameraWrapper } from './CameraWrapper'
import { useScene } from './SceneProvider'
import type { CameraPresetMap, SceneId } from './SceneTypes'

type SceneRendererProps = {
  scenes: Partial<Record<SceneId, React.ReactNode>>
  presets: CameraPresetMap
  className?: string
}

/**
 * Renders the active scene and drives camera animation between presets.
 */
export function SceneRenderer({ scenes, presets, className }: SceneRendererProps) {
  const { currentScene, transitionState, finishTransition } = useScene()

  const sceneNode = scenes[currentScene] ?? null
  const preset =
    presets[currentScene] ??
    presets.court ?? {
      x: 0,
      y: 0,
      scale: 1,
    }

  const isTransitioning = transitionState === 'transitioning'

  return (
    <CameraWrapper
      preset={preset}
      isTransitioning={isTransitioning}
      onTransitionEnd={finishTransition}
      className="w-full h-full overflow-hidden"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScene}
          className={className ?? 'w-full h-full'}
          initial={{ opacity: 0 }}
          animate={{ opacity: motionTokens.opacity.entering }}
          exit={{ opacity: motionTokens.opacity.exiting }}
          transition={{ duration: motionTokens.fade.duration, ease: motionTokens.fade.ease }}
        >
          {sceneNode}
        </motion.div>
      </AnimatePresence>
    </CameraWrapper>
  )
}
