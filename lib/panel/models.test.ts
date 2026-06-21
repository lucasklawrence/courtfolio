import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const generateObject = vi.fn()
vi.mock('ai', () => ({ generateObject: (args: unknown) => generateObject(args) }))

// Imported after the mock is registered.
const { generateStructured, DEFAULT_LINEUP } = await import('./models')

describe('generateStructured', () => {
  it('forwards model/system/prompt/schema and returns the validated object', async () => {
    generateObject.mockResolvedValueOnce({ object: { ok: true } })
    const schema = z.object({ ok: z.boolean() })

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
    })
  })
})

describe('DEFAULT_LINEUP', () => {
  it('spreads personas across three families and uses a stronger meta-judge', () => {
    expect(Object.keys(DEFAULT_LINEUP.personas).sort()).toEqual(['anthropic', 'google', 'openai'])
    expect(DEFAULT_LINEUP.metaJudge).toContain('sonnet')
    for (const id of Object.values(DEFAULT_LINEUP.personas)) expect(id).toMatch(/^\w+\//)
  })
})
