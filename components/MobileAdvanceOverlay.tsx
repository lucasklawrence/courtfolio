'use client'

import { useCallback } from 'react'

type Props = {
  active: boolean
  onAdvance: () => void
}

export function MobileAdvanceOverlay({ active, onAdvance }: Props) {
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' && e.isPrimary) {
      onAdvance()
    }
  }, [onAdvance])

  if (!active) return null

  return (
    <div
      className="fixed top-0 left-0 w-screen h-screen z-[100] cursor-pointer"
      style={{
        touchAction: 'pan-x pan-y', // allows pinch-to-zoom
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerUp={handlePointerUp}
    />
  )
}