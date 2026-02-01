'use client'

import dynamic from 'next/dynamic'

const BannersClient = dynamic(() => import('@/components/banners/BannersClient'), {
  loading: () => <div className="text-center text-white py-12">Loading banners...</div>,
})

export function BannersScene() {
  return <BannersClient />
}
