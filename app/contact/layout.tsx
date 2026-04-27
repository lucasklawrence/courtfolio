/**
 * @file Server-component layout for the Front Office (contact) route.
 * Exists solely to export route-specific {@link metadata}, which the
 * client-component `page.tsx` cannot do directly.
 */

import type { Metadata } from 'next'
import type { JSX, ReactNode } from 'react'

/**
 * Front Office metadata. Title participates in the root layout's
 * `'%s | Lucas Lawrence'` template; description is route-specific.
 */
export const metadata: Metadata = {
  title: 'Front Office',
  description:
    'Front office of lucasklawrence.com — get in touch with Lucas Lawrence by email, LinkedIn, or download the full résumé.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Front Office | Lucas Lawrence',
    description:
      'Front office of lucasklawrence.com — get in touch with Lucas Lawrence by email, LinkedIn, or download the full résumé.',
    url: '/contact',
  },
}

/**
 * Pass-through layout. Metadata is resolved at the route segment;
 * children render unchanged.
 */
export default function ContactLayout({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>
}
