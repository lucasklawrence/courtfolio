import type { CameraPresetMap } from '@/components/scene/SceneProvider'

export const WORLD_W = 1536
export const WORLD_H = 1024
export const GAP_X = 200
export const GAP_Y = 200

/**
 * Camera presets laid out on a 2D grid using shared 1536x1024 viewboxes.
 * Tweak coordinates as we refine the stitched world.
 */
export const cameraPresets: CameraPresetMap = {
  court: { x: 0, y: 0, scale: 1 },
  'locker-room': { x:0, y: 0, scale: 1 },
  'front-office': { x: 2 * (WORLD_W + GAP_X), y: 0, scale: 1 },
  projects: { x: 2 * (WORLD_W + GAP_X), y: WORLD_H + GAP_Y, scale: 1 },
  // Banners (rafters content) sits lower in its layout; lift it by translating up.
  banners: { x: 0, y: -0, scale: 1 },
  'film-room': { x: 0, y: WORLD_H + GAP_Y, scale: 1 },
  rafters: { x: 0, y: 400, scale: 1 },
}
