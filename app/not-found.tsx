import type { Metadata } from 'next'
import { AirballScene } from '@/components/not-found/AirballScene'

/**
 * Page-specific metadata for the 404. Overrides the default site title so
 * browser tabs, history, and search results clearly identify the missing
 * page rather than inheriting the generic homepage title.
 */
export const metadata: Metadata = {
  title: '404 — Lucas Lawrence | Court Site',
  description: 'This page sailed wide. Head back to the home court.',
}

/**
 * NotFound is the Next.js App Router 404 entry. Kept as a server component
 * so it can export `metadata`; the interactive court scene lives in
 * `AirballScene` (client) which reads the failed URL via `usePathname`.
 */
export default function NotFound() {
  return <AirballScene />
}
