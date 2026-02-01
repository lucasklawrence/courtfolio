export type SceneId =
  | 'court'
  | 'locker-room'
  | 'rafters'
  | 'film-room'
  | 'front-office'
  | 'projects'
  | 'banners'

export type TransitionState = 'idle' | 'transitioning'

export type CameraPreset = {
  x: number
  y: number
  scale: number
  opacity?: number
}

export type SceneContextValue = {
  currentScene: SceneId
  previousScene: SceneId | null
  transitionState: TransitionState
  goToScene: (sceneId: SceneId, options?: { force?: boolean }) => void
  finishTransition: () => void
}
