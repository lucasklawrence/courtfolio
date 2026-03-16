type SceneNavigationPayload = {
  from: string | null
  to: string
  reason?: string
}

/**
  * Lightweight analytics stub; replace with real provider (e.g., PostHog/Segment) later.
  */
export function trackSceneNavigation(payload: SceneNavigationPayload) {
  if (typeof window === 'undefined') return
  // eslint-disable-next-line no-console
  console.info('[scene] navigation', payload)

  window.dispatchEvent(
    new CustomEvent('scene:navigation', {
      detail: payload,
    })
  )
}
