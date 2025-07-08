'use client'

import { useEffect, useState } from 'react'

export function useSingleColumn(breakpointPx = 640): boolean {
  const [isSingle, setIsSingle] = useState(false)

  useEffect(() => {
    const check = () => setIsSingle(window.innerWidth < breakpointPx)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpointPx])

  return isSingle
}
