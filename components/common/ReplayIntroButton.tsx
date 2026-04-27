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
      aria-label="Replay tunnel intro animation"
      className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-orange-600 text-white hover:bg-orange-500 transition shadow-sm whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
    >
      <span aria-hidden="true">🔁</span> Replay Tunnel Intro
    </button>
  )
}
