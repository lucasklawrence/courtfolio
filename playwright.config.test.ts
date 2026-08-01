import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import config from './playwright.config'

/**
 * Guards the trap #359 called out: each project's `testMatch` is a literal
 * filename alternation, so a spec file that isn't named in one of them is
 * **silently never run**. Add a spec, watch CI go green, and have covered
 * nothing — with no signal anywhere that it happened.
 *
 * These assertions are cheap and turn that into a failing test.
 */

/** Every `*.spec.ts` under `e2e/`, which is what Playwright's `testDir` collects. */
function specFiles(): string[] {
  return readdirSync(join(process.cwd(), 'e2e'))
    .filter((name) => name.endsWith('.spec.ts'))
    .sort()
}

/** The projects declared in the Playwright config, narrowed to what this test needs. */
function projects(): { name: string; testMatch: RegExp }[] {
  return (config.projects ?? []).map((p) => ({
    name: String(p.name),
    testMatch: p.testMatch as RegExp,
  }))
}

describe('playwright config', () => {
  it('finds spec files to check', () => {
    // Sanity: an empty list would make every assertion below vacuously true.
    expect(specFiles().length).toBeGreaterThan(0)
  })

  it('declares every project with a RegExp testMatch', () => {
    for (const project of projects()) {
      expect(project.testMatch, `${project.name} testMatch`).toBeInstanceOf(RegExp)
    }
  })

  it('runs every e2e spec in at least one project', () => {
    const all = projects()
    const orphans = specFiles().filter(
      (file) => !all.some((project) => project.testMatch.test(file)),
    )
    expect(
      orphans,
      `spec files matched by no project's testMatch — they would never run:\n  ${orphans.join('\n  ')}`,
    ).toEqual([])
  })

  it('has no project whose testMatch selects nothing', () => {
    // The mirror failure: a project whose alternation names a spec that was
    // renamed or deleted quietly stops testing anything.
    const files = specFiles()
    const empty = projects()
      .filter((project) => !files.some((file) => project.testMatch.test(file)))
      .map((project) => project.name)
    expect(empty, 'projects matching zero specs').toEqual([])
  })

  it('covers the rendering specs in the mobile project', () => {
    // The point of #359: these two exist to be run at phone width in WebKit.
    // If they drop out of `mobile-webkit`, the coverage gap silently reopens.
    const mobile = projects().find((p) => p.name === 'mobile-webkit')
    expect(mobile).toBeDefined()
    expect(mobile?.testMatch.test('svg-fragments.spec.ts')).toBe(true)
    expect(mobile?.testMatch.test('chart-overflow.spec.ts')).toBe(true)
  })
})
