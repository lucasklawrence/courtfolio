import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { repoEvidence } from './repo-evidence'

describe('repoEvidence', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'panel-evidence-'))
    await writeFile(path.join(root, 'small.ts'), 'export const a = 1\n', 'utf8')
    await writeFile(path.join(root, 'big.ts'), 'x'.repeat(5000), 'utf8')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reads real files into citable artifacts and seeds the summary', async () => {
    const ev = await repoEvidence({
      targetId: 'demo',
      title: 'Demo',
      description: 'A demo project.',
      paths: ['small.ts'],
      rootDir: root,
    })
    expect(ev.targetId).toBe('demo')
    expect(ev.summary).toContain('A demo project.')
    expect(ev.summary).toContain('1 of 1 real source files')
    expect(ev.artifacts[0].excerpt).toContain('export const a = 1')
  })

  it('truncates excerpts past the budget and marks the cut', async () => {
    const ev = await repoEvidence({
      targetId: 'demo',
      title: 'Demo',
      description: 'd',
      paths: ['big.ts'],
      rootDir: root,
      maxExcerptChars: 100,
    })
    expect(ev.artifacts[0].excerpt).toContain('[truncated,')
    expect(ev.artifacts[0].excerpt.length).toBeLessThan(200)
  })

  it('records unreadable files as a note instead of throwing', async () => {
    const ev = await repoEvidence({
      targetId: 'demo',
      title: 'Demo',
      description: 'd',
      paths: ['nope.ts'],
      rootDir: root,
    })
    expect(ev.artifacts[0].note).toMatch(/unreadable/)
    expect(ev.artifacts[0].excerpt).toBe('')
    expect(ev.summary).toContain('0 of 1 real source files')
  })
})
