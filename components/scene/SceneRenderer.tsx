'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { CameraWrapper } from './CameraWrapper'
import { useScene } from './SceneProvider'
import type { CameraPresetMap, SceneId } from './SceneTypes'
import { WORLD_H, WORLD_W } from '@/constants/cameraPresets'

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
  const [scaleToFit, setScaleToFit] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      if (typeof window === 'undefined') return
      const { innerWidth, innerHeight } = window
      const scale = Math.min(1, innerWidth / WORLD_W, innerHeight / WORLD_H)
      setScaleToFit(scale)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const entries = useMemo(
    () =>
      Object.entries(scenes).map(([id, node]) => {
        const preset = presets[id as SceneId] ?? presets.court ?? { x: 0, y: 0, scale: 1 }
        return { id: id as SceneId, node, preset }
      }),
    [scenes, presets]
  )

  const minX = Math.min(...entries.map(e => e.preset.x))
  const maxX = Math.max(...entries.map(e => e.preset.x))
  const minY = Math.min(...entries.map(e => e.preset.y))
  const maxY = Math.max(...entries.map(e => e.preset.y))

  const worldWidth = maxX - minX + WORLD_W
  const worldHeight = maxY - minY + WORLD_H

  const activePreset =
    presets[currentScene] ??
    presets.court ?? {
      x: 0,
      y: 0,
      scale: 1,
    }

  const adjustedPreset = {
    ...activePreset,
    x: activePreset.x - minX,
    y: activePreset.y - minY,
    scale: (activePreset.scale ?? 1) * scaleToFit,
  }

  const isTransitioning = transitionState === 'transitioning'

  return (
    <CameraWrapper
      preset={adjustedPreset}
      isTransitioning={isTransitioning}
      onTransitionEnd={finishTransition}
      className="w-full h-full overflow-hidden flex items-center justify-center"
    >
      <div
        className={className ?? 'relative'}
        style={{
          width: worldWidth,
          height: worldHeight,
          position: 'relative',
        }}
      >
        {entries.map(({ id, node, preset }) => (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: preset.x - minX,
              top: preset.y - minY,
              width: WORLD_W,
              height: WORLD_H,
              pointerEvents: id === currentScene ? 'auto' : 'none',
              opacity: id === currentScene ? 1 : 0,
              visibility: id === currentScene ? 'visible' : 'hidden',
            }}
            aria-hidden={id !== currentScene}
          >
            {node}
          </div>
        ))}
      </div>
    </CameraWrapper>
  )
}
