/**
 * Guards the worktree-only Turbopack root in `next.config.ts`.
 *
 * The widening must fire for a linked `node_modules` (what
 * `scripts/worktree-init.ps1` creates) and for nothing else — a real install is
 * what Vercel and CI have, and their builds must keep the default root.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { linkedWorktreeRoot } from './next.config'

describe('linkedWorktreeRoot', () => {
  let main: string

  beforeEach(() => {
    main = fs.mkdtempSync(path.join(os.tmpdir(), 'linked-root-'))
    fs.mkdirSync(path.join(main, 'node_modules'))
  })

  afterEach(() => {
    fs.rmSync(main, { recursive: true, force: true })
  })

  it('returns the main checkout for a worktree whose node_modules is a link', () => {
    const worktree = path.join(main, '.claude', 'worktrees', 'slug')
    fs.mkdirSync(worktree, { recursive: true })
    // 'junction' is what the bootstrap makes on Windows; other platforms ignore
    // the type and create an ordinary directory symlink.
    fs.symlinkSync(path.join(main, 'node_modules'), path.join(worktree, 'node_modules'), 'junction')

    expect(linkedWorktreeRoot(worktree)).toBe(fs.realpathSync(main))
  })

  it('leaves a real install alone, as on Vercel and CI', () => {
    expect(linkedWorktreeRoot(main)).toBeUndefined()
  })

  it('leaves a directory with no node_modules alone', () => {
    const bare = path.join(main, 'bare')
    fs.mkdirSync(bare)
    expect(linkedWorktreeRoot(bare)).toBeUndefined()
  })
})
