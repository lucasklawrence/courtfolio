import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const generateObject = vi.fn()
vi.mock('ai', () => ({ generateObject: (args: unknown) => generateObject(args) }))

// Imported after the mock is registered.
const { generateStructured, DEFAULT_LINEUP } = await import('./models')

const schema = z.object({ ok: z.boolean() })

describe('generateStructured', () => {
  // Braces matter: `mockReset()` returns the mock, and a function returned
  // from `beforeEach` is treated as a cleanup hook — vitest would then invoke
  // the mock itself (arg-less) after every test.
  beforeEach(() => {
    generateObject.mockReset()
  })

  it('forwards model/system/prompt/schema, pins maxRetries to 1, and returns the validated object', async () => {
    generateObject.mockResolvedValueOnce({ object: { ok: true } })

    const result = await generateStructured({
      model: 'anthropic/claude-haiku-4.5',
      system: 'sys',
      prompt: 'do it',
      schema,
    })

    expect(result).toEqual({ ok: true })
    expect(generateObject).toHaveBeenCalledWith({
      model: 'anthropic/claude-haiku-4.5',
      system: 'sys',
      prompt: 'do it',
      schema,
      maxRetries: 1,
    })
  })

  it('passes maxOutputTokens and abortSignal through when provided', async () => {
    generateObject.mockResolvedValueOnce({ object: { ok: true } })
    const ac = new AbortController()

    await generateStructured({
      model: 'm',
      system: 's',
      prompt: 'p',
      schema,
      maxOutputTokens: 900,
      signal: ac.signal,
    })

    const args = generateObject.mock.calls[0][0]
    expect(args.maxRetries).toBe(1)
    expect(args.maxOutputTokens).toBe(900)
    expect(args.abortSignal).toBe(ac.signal)
  })

  it('omits maxOutputTokens and abortSignal from the call when not provided', async () => {
    generateObject.mockResolvedValueOnce({ object: { ok: true } })

    await generateStructured({ model: 'm', system: 's', prompt: 'p', schema })

    const args = generateObject.mock.calls[0][0]
    expect(args.maxRetries).toBe(1)
    expect(args).not.toHaveProperty('maxOutputTokens')
    expect(args).not.toHaveProperty('abortSignal')
  })
})

describe('DEFAULT_LINEUP', () => {
  it('spreads personas across three families and uses a stronger meta-judge', () => {
    expect(Object.keys(DEFAULT_LINEUP.personas).sort()).toEqual(['anthropic', 'google', 'openai'])
    expect(DEFAULT_LINEUP.metaJudge).toContain('sonnet')
    for (const id of Object.values(DEFAULT_LINEUP.personas)) expect(id).toMatch(/^\w+\//)
  })
})
