/**
 * @file Server-component layout for the Project Binder route.
 * Exists solely to export route-specific {@link metadata}, which the
 * client-component `page.tsx` cannot do directly.
 */

import type { Metadata } from 'next'
import type { JSX, ReactNode } from 'react'

/**
 * Project Binder metadata. Title participates in the root layout's
 * `'%s | Lucas Lawrence'` template; description is route-specific.
 */
export const metadata: Metadata = {
  title: 'Project Binder',
  description:
    "Lucas Lawrence's project binder — featured engineering work, side projects, and the tech stack behind each one.",
  alternates: { canonical: '/projects' },
  openGraph: {
    title: 'Project Binder | Lucas Lawrence',
    description:
      "Lucas Lawrence's project binder — featured engineering work, side projects, and the tech stack behind each one.",
    url: '/projects',
  },
}

/**
 * Pass-through layout. Metadata is resolved at the route segment;
 * children render unchanged.
 */
export default function ProjectsLayout({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>
}
