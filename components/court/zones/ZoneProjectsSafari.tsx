import { SafeSvgHtml } from './common/SafeSvgHtml'
import { useRouter } from 'next/navigation'

export function ZoneProjectsSafari() {
  const router = useRouter()

  return (
    <SafeSvgHtml>
      <div
        onClick={() => router.push('/projects')}
        style={{
          backgroundColor: '#582c0d',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          border: '1px solid #fcae40',
          fontSize: '12px',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        <h3 style={{ color: '#FDBA74', fontSize: '14px', margin: '0 0 4px' }}>🎨 Projects</h3>
        <p style={{ margin: 0, fontSize: '11px' }}>
          Explore my plays — featuring Bars of the Day and more.
        </p>
      </div>
    </SafeSvgHtml>
  )
}
