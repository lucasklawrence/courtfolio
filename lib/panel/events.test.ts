import { describe, expect, it, vi } from 'vitest'
import { emitPanelEvent, errorTypeOf, isAbortError } from './events'
import type { PanelEvent } from './types'

const event: PanelEvent = { type: 'verify-start', gapCount: 3 }

describe('emitPanelEvent', () => {
  it('calls the listener with the event', () => {
    const onEvent = vi.fn()
    emitPanelEvent({ onEvent }, event)
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(event)
  })

  it('swallows a throwing listener — observation can never fail the run', () => {
    const onEvent = vi.fn(() => {
      throw new Error('listener bug')
    })
    expect(() => emitPanelEvent({ onEvent }, event)).not.toThrow()
    expect(onEvent).toHaveBeenCalledWith(event)
  })

  it('tolerates undefined opts and opts without a listener', () => {
    expect(() => emitPanelEvent(undefined, event)).not.toThrow()
    expect(() => emitPanelEvent({}, event)).not.toThrow()
  })
})

describe('errorTypeOf', () => {
  it('returns the error name for Error instances', () => {
    expect(errorTypeOf(new TypeError('boom'))).toBe('TypeError')
    expect(errorTypeOf(new Error('boom'))).toBe('Error')
  })

  it('falls back to the constructor name when the name is blank', () => {
    class NamelessError extends Error {
      constructor() {
        super('boom')
        this.name = ''
      }
    }
    expect(errorTypeOf(new NamelessError())).toBe('NamelessError')
  })

  it('never leaks the message — only the type', () => {
    expect(errorTypeOf(new Error('secret payload'))).not.toContain('secret')
  })

  it('returns the typeof for non-Error throws', () => {
    expect(errorTypeOf('boom')).toBe('string')
    expect(errorTypeOf(42)).toBe('number')
    expect(errorTypeOf(undefined)).toBe('undefined')
  })
})

describe('isAbortError', () => {
  // Real signal reasons (not `new DOMException(...)`) on purpose: production
  // cancellations arrive as an AbortSignal's reason, and vitest's jsdom
  // environment supplies a window-realm DOMException whose prototype chain
  // does not reach Node's Error — a realm quirk the engine never sees at
  // runtime (Node's DOMException extends Error).
  it('recognizes AbortError (manual abort)', () => {
    expect(isAbortError(AbortSignal.abort().reason)).toBe(true)
  })

  it('recognizes TimeoutError (AbortSignal.timeout)', async () => {
    const signal = AbortSignal.timeout(0)
    await new Promise(resolve => signal.addEventListener('abort', resolve))
    expect(isAbortError(signal.reason)).toBe(true)
  })

  it('rejects ordinary errors and non-errors', () => {
    expect(isAbortError(new TypeError('boom'))).toBe(false)
    expect(isAbortError('AbortError')).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })
})
