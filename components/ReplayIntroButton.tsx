'use client'

/**
 * ReplayIntroButton allows the user to restart the TunnelHero animation
 * by clearing the localStorage flag and reloading the page.
 */
export function ReplayIntroButton() {
  const handleReplay = () => {
    localStorage.removeItem('hasSeenIntro')
    window.location.reload()
  }

  return (
    <button
      onClick={handleReplay}
      className="mt-6 text-sm text-neutral-400 hover:text-orange-500 transition underline"
    >
      🔁 Replay Tunnel Intro
    </button>
  )
}
