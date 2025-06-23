'use client'

import { useCallback } from 'react'

type Props = {
  active: boolean
  onAdvance: () => void
}

export function MobileAdvanceOverlay({ active, onAdvance }: Props) {
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch' && e.isPrimary) {
        onAdvance()
      }
    },
    [onAdvance]
  )

  if (!active) return null

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{
        touchAction: 'pan-x pan-y',
        pointerEvents: 'auto',
      }}
      onPointerUp={e => {
        // Only trigger if tapping outside of .ui-allow-click
        if (!(e.target as HTMLElement).closest('.ui-allow-click')) {
          onAdvance()
        }
      }}
    />
  )
}
