import type { CameraPresetMap } from '@/components/scene/SceneProvider'

/**
 * Baseline camera presets (tweak as we wire scenes and assets).
 * Coordinates assume a shared SVG world; adjust once layouts are aligned.
 */
export const cameraPresets: CameraPresetMap = {
  court: { x: 0, y: 0, scale: 1 },
  'locker-room': { x: 1400, y: 0, scale: 1 },
  rafters: { x: 0, y: -400, scale: 0.95, opacity: 1 },
  'film-room': { x: 0, y: 400, scale: 1 },
  'front-office': { x: 2800, y: 0, scale: 1 },
  projects: { x: 2800, y: 400, scale: 1 },
  banners: { x: 0, y: -800, scale: 1 },
}
