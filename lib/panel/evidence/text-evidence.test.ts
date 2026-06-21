import { describe, expect, it } from 'vitest'
import { textEvidence } from './text-evidence'

describe('textEvidence', () => {
  it('wraps a summary with default-empty artifacts', () => {
    const ev = textEvidence('decision-1', 'Take the job?', 'Weighing offer A vs B.')
    expect(ev).toEqual({
      targetId: 'decision-1',
      title: 'Take the job?',
      summary: 'Weighing offer A vs B.',
      artifacts: [],
    })
  })

  it('passes through supplied artifacts', () => {
    const ev = textEvidence('x', 'X', 's', [{ path: 'a', excerpt: 'b' }])
    expect(ev.artifacts).toHaveLength(1)
    expect(ev.artifacts[0].path).toBe('a')
  })
})
