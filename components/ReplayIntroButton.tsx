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
      className="px-3 py-1 text-xs rounded-full bg-orange-700 text-white hover:bg-orange-600 shadow transition"
    >
      🔁 Replay Tunnel Intro
    </button>
  )
}
