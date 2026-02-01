import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import { useRouter } from 'next/navigation'
import { useArenaNav } from '@/src/arena/ArenaShell'

export function ZoneProjectsSafari() {
  const router = useRouter()
  const arenaNav = useArenaNav()

  const handleClick = () => {
    if (arenaNav) {
      arenaNav.navigate('/projects')
    } else {
      router.push('/projects')
    }
  }

  return (
    <SafeSvgHtml>
      <div
        onClick={handleClick}
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
