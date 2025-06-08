import { SafeSvgHtml } from './SafeSvgHtml'
import { useRouter } from 'next/navigation'

export function ZoneProjectsModern() {
  const router = useRouter()

  return (
    <foreignObject x="800" y="700" width="250" height="120">
      <SafeSvgHtml>
        <div
          onClick={() => router.push('/projects')}
          style={{
            backgroundColor: 'rgba(88, 44, 13, 0.8)',
            backdropFilter: 'blur(4px)',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 165, 0, 0.3)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease-in-out',
          }}
          onMouseOver={e => {
            ;(e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)'
          }}
          onMouseOut={e => {
            ;(e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
          }}
        >
          <h3
            style={{
              textAlign: 'center',
              fontWeight: 'bold',
              color: '#FDBA74',
              fontSize: '0.875rem',
            }}
          >
            🎨 Projects
          </h3>
          <p
            style={{
              fontSize: '0.75rem',
              textAlign: 'center',
              marginTop: '0.25rem',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: '1.25rem',
            }}
          >
            Explore my plays — featuring Bars of the Day and more.
          </p>
        </div>
      </SafeSvgHtml>
    </foreignObject>
  )
}
