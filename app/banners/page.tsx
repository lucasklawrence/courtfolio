import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

/**
 * Rafters & Banners metadata. Title participates in the root layout's
 * `'%s | Lucas Lawrence'` template; description is route-specific.
 */
export const metadata: Metadata = {
  title: 'Rafters & Banners',
  description:
    "Lucas Lawrence's rafters — career milestones, awards, and standout achievements hanging as banners above the court.",
  alternates: { canonical: '/banners' },
  openGraph: {
    title: 'Rafters & Banners | Lucas Lawrence',
    description:
      "Lucas Lawrence's rafters — career milestones, awards, and standout achievements hanging as banners above the court.",
    url: '/banners',
  },
}

const BannersClient = dynamic(() => import('@/components/banners/BannersClient'), {
  loading: () => <div className="text-center text-white py-12">Loading banners...</div>,
})

/**
 * Server-component page wrapper that ships {@link metadata} and lazy-loads
 * the interactive banners client.
 */
export default function BannersPage() {
  return <BannersClient />
}
