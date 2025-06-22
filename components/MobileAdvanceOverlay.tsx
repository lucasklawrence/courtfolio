'use client'

type Props = {
  active: boolean
  onAdvance: () => void
}

export function MobileAdvanceOverlay({ active, onAdvance }: Props) {
  if (!active) return null

  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen z-[100] cursor-pointer"
      style={{
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={onAdvance}
    />
  )
}
