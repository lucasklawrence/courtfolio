import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import { useRouter } from 'next/navigation'

export function ZoneAboutModern() {
  const router = useRouter()

  return (
    <SafeSvgHtml>
      <button
        onClick={() => router.push('/about')}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(38, 20, 4, 0.7)',
          backdropFilter: 'blur(4px)',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.875rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 165, 0, 0.3)',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'color 0.2s ease-in-out',
        }}
        onMouseOver={e => {
          ;(e.currentTarget as HTMLButtonElement).style.color = '#FDBA74'
        }}
        onMouseOut={e => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'white'
        }}
      >
        ⛹️‍♂️ About Me
      </button>
    </SafeSvgHtml>
  )
}
