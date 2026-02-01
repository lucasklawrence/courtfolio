import type { CameraPresetMap } from '@/components/scene/SceneProvider'

/**
 * Baseline camera presets. Currently zeroed because scenes render one-at-a-time;
 * adjust to world coordinates once a shared SVG world is stitched.
 */
export const cameraPresets: CameraPresetMap = {
  court: { x: 0, y: 0, scale: 1 },
  'locker-room': { x: 0, y: 0, scale: 1 },
  rafters: { x: 0, y: 0, scale: 1 },
  'film-room': { x: 0, y: 0, scale: 1 },
  'front-office': { x: 0, y: 0, scale: 1 },
  projects: { x: 0, y: 0, scale: 1 },
  banners: { x: 0, y: 0, scale: 1 },
}
