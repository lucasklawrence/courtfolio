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
      className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-orange-600 text-white hover:bg-orange-500 active:scale-95 transition shadow-sm whitespace-nowrap cursor-pointer"
    >
      Replay Intro
    </button>
  )
}
