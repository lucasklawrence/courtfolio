import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useIsSafari } from './useIsSafari'

const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function Probe() {
  return <span>{useIsSafari() ? 'safari' : 'modern'}</span>
}

describe('useIsSafari', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the non-Safari branch on the server, even for a Safari user agent', () => {
    vi.stubGlobal('navigator', { userAgent: SAFARI_UA })
    expect(renderToString(<Probe />)).toContain('modern')
  })

  it('hydrates Safari without a mismatch, then switches to the Safari branch', async () => {
    const html = renderToString(<Probe />)
    const container = document.createElement('div')
    container.innerHTML = html
    vi.stubGlobal('navigator', { userAgent: SAFARI_UA })
    // React reports a hydration mismatch through this callback.
    const onRecoverableError = vi.fn()

    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError })
    })

    expect(onRecoverableError).not.toHaveBeenCalled()
    expect(container.textContent).toBe('safari')
  })
})
