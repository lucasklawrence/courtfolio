// TARGET PATH: src/arena/CourtZoneLink.tsx
'use client'

import Link, { type LinkProps } from 'next/link'
import type { MouseEventHandler, ReactNode } from 'react'
import { useArenaNav } from './ArenaShell'

type CourtZoneLinkProps = LinkProps & {
  children: ReactNode
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
}

export function CourtZoneLink({ href, onClick, ...props }: CourtZoneLinkProps) {
  const arenaNav = useArenaNav()

  const handleClick: MouseEventHandler<HTMLAnchorElement> = event => {
    onClick?.(event)
    if (event.defaultPrevented) return

    if (arenaNav?.navigate && typeof href === 'string') {
      event.preventDefault()
      arenaNav.navigate(href)
    }
  }

  return <Link {...props} href={href} onClick={handleClick} />
}
