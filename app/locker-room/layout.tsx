/**
 * @file Server-component layout for the Locker Room route.
 * Exists solely to export route-specific {@link metadata}, which the
 * client-component `page.tsx` cannot do directly.
 */

import type { Metadata } from 'next'
import type { JSX, ReactNode } from 'react'

/**
 * Locker Room metadata. Title participates in the root layout's
 * `'%s | Lucas Lawrence'` template; description is route-specific.
 */
export const metadata: Metadata = {
  title: 'Locker Room',
  description:
    "Step into Lucas Lawrence's locker room — jerseys, shoes, gear, patents, and the personal items behind the engineer.",
  alternates: { canonical: '/locker-room' },
  openGraph: {
    title: 'Locker Room | Lucas Lawrence',
    description:
      "Step into Lucas Lawrence's locker room — jerseys, shoes, gear, patents, and the personal items behind the engineer.",
    url: '/locker-room',
  },
}

/**
 * Pass-through layout. Metadata is resolved at the route segment;
 * children render unchanged.
 */
export default function LockerRoomLayout({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>
}
