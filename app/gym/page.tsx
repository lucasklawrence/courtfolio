import dynamic from 'next/dynamic'

const GymClient = dynamic(() => import('@/components/gym/GymBody').then(m => ({ default: m.GymBody })), {
  loading: () => (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
        color: '#666',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        letterSpacing: '2px',
      }}
    >
      Loading training facility...
    </div>
  ),
})

export default function GymPage() {
  return <GymClient />
}
