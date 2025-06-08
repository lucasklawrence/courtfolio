import { SafeSvgHtml } from './SafeSvgHtml'
import { useRouter } from 'next/navigation'

export function ZoneAboutSafari() {
  const router = useRouter()

  return (
    <foreignObject x="690" y="480" width="130" height="70">
      <SafeSvgHtml>
        <button
          onClick={() => router.push('/about')}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#261404',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.875rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(255, 165, 0, 0.3)',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          ⛹️‍♂️ About Me
        </button>
      </SafeSvgHtml>
    </foreignObject>
  )
}
