// @vitest-environment node

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  BenchmarkSchema,
  BenchmarkUpdateSchema,
  getBenchmarksFile,
  isDevRuntime,
  isValidDate,
  readBenchmarks,
  writeBenchmarks,
} from './movement-benchmarks-store'

/**
 * Per-test tmp dir for filesystem isolation. We don't want any test in this
 * file (or the API route tests downstream) to mutate the real
 * `public/data/movement_benchmarks.json` fixture.
 */
let tmpDir: string
let tmpFile: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'movement-store-'))
  tmpFile = path.join(tmpDir, 'movement_benchmarks.json')
  vi.stubEnv('MOVEMENT_BENCHMARKS_FILE', tmpFile)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('getBenchmarksFile', () => {
  it('returns the env override when set', () => {
    expect(getBenchmarksFile()).toBe(tmpFile)
  })

  it('falls back to public/data/ default when env is unset', () => {
    vi.unstubAllEnvs()
    vi.stubEnv('MOVEMENT_BENCHMARKS_FILE', '')
    const resolved = getBenchmarksFile()
    expect(resolved.endsWith(path.join('public', 'data', 'movement_benchmarks.json'))).toBe(true)
  })

  it('treats empty-string override as missing', () => {
    vi.stubEnv('MOVEMENT_BENCHMARKS_FILE', '')
    expect(getBenchmarksFile().endsWith('movement_benchmarks.json')).toBe(true)
    expect(getBenchmarksFile()).not.toBe('')
  })
})

describe('BenchmarkSchema', () => {
  it('accepts a full valid payload', () => {
    const valid = {
      date: '2026-04-15',
      bodyweight_lbs: 232.4,
      shuttle_5_10_5_s: 5.12,
      vertical_in: 22,
      sprint_10y_s: 1.85,
      notes: 'felt fast',
      is_complete: true,
    }
    expect(() => BenchmarkSchema.parse(valid)).not.toThrow()
  })

  it('accepts a minimal payload (only date)', () => {
    expect(() => BenchmarkSchema.parse({ date: '2026-04-15' })).not.toThrow()
  })

  it.each([
    '2026-4-15', // missing leading zero
    '2026/04/15', // wrong separator
    '04-15-2026', // wrong order
    '2026-04-15T00:00:00Z', // ISO timestamp, not calendar date
    '',
    'tomorrow',
  ])('rejects non-ISO date %s', (date) => {
    expect(() => BenchmarkSchema.parse({ date })).toThrow()
  })

  it('rejects non-positive numeric metrics', () => {
    expect(() => BenchmarkSchema.parse({ date: '2026-04-15', bodyweight_lbs: 0 })).toThrow()
    expect(() => BenchmarkSchema.parse({ date: '2026-04-15', bodyweight_lbs: -1 })).toThrow()
    expect(() => BenchmarkSchema.parse({ date: '2026-04-15', vertical_in: -22 })).toThrow()
  })

  it('rejects unknown fields (.strict prevents typo data loss)', () => {
    // The whole point of .strict() — `bodyweight_lb` instead of `bodyweight_lbs` should fail loudly.
    expect(() =>
      BenchmarkSchema.parse({ date: '2026-04-15', bodyweight_lb: 232 }),
    ).toThrow()
  })
})

describe('BenchmarkUpdateSchema', () => {
  it('strips date — passing date is treated as an unknown field under .strict()', () => {
    expect(() =>
      BenchmarkUpdateSchema.parse({ date: '2026-04-15', bodyweight_lbs: 232 }),
    ).toThrow()
  })

  it('accepts an empty update (all fields optional)', () => {
    expect(() => BenchmarkUpdateSchema.parse({})).not.toThrow()
  })

  it('accepts a single-field update', () => {
    expect(() => BenchmarkUpdateSchema.parse({ vertical_in: 23.5 })).not.toThrow()
  })

  it('rejects unknown fields', () => {
    expect(() => BenchmarkUpdateSchema.parse({ bodyweight_lb: 232 })).toThrow()
  })
})

describe('readBenchmarks', () => {
  it('returns [] when the file is missing (pre-baseline state)', async () => {
    await expect(readBenchmarks()).resolves.toEqual([])
  })

  it('returns [] when the file exists but is empty', async () => {
    await fs.writeFile(tmpFile, '', 'utf8')
    await expect(readBenchmarks()).resolves.toEqual([])
  })

  it('returns [] when the file is whitespace-only', async () => {
    await fs.writeFile(tmpFile, '  \n\n  ', 'utf8')
    await expect(readBenchmarks()).resolves.toEqual([])
  })

  it('throws when the file is malformed JSON', async () => {
    await fs.writeFile(tmpFile, '{not valid json', 'utf8')
    await expect(readBenchmarks()).rejects.toThrow()
  })

  it('parses valid JSON into an array of benchmarks', async () => {
    const raw = JSON.stringify([
      { date: '2026-04-15', bodyweight_lbs: 232 },
      { date: '2026-03-15', bodyweight_lbs: 235 },
    ])
    await fs.writeFile(tmpFile, raw, 'utf8')
    const result = await readBenchmarks()
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026-04-15')
  })

  it('throws when an entry has unknown fields (strict mode propagates)', async () => {
    const raw = JSON.stringify([{ date: '2026-04-15', bodyweight_lb: 232 }])
    await fs.writeFile(tmpFile, raw, 'utf8')
    await expect(readBenchmarks()).rejects.toThrow()
  })
})

describe('writeBenchmarks', () => {
  it('sorts entries newest-first by date', async () => {
    await writeBenchmarks([
      { date: '2026-01-15' },
      { date: '2026-04-15' },
      { date: '2026-02-15' },
    ])
    const written = JSON.parse(await fs.readFile(tmpFile, 'utf8'))
    expect(written.map((b: { date: string }) => b.date)).toEqual([
      '2026-04-15',
      '2026-02-15',
      '2026-01-15',
    ])
  })

  it('creates the parent directory if it does not exist (first-POST case)', async () => {
    const nested = path.join(tmpDir, 'deeply', 'nested', 'benchmarks.json')
    vi.stubEnv('MOVEMENT_BENCHMARKS_FILE', nested)
    await writeBenchmarks([{ date: '2026-04-15' }])
    await expect(fs.access(nested)).resolves.toBeUndefined()
  })

  it('writes a trailing newline so git diffs stay clean', async () => {
    await writeBenchmarks([{ date: '2026-04-15' }])
    const raw = await fs.readFile(tmpFile, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
  })

  it('does not mutate the caller-supplied array order', async () => {
    const input = [
      { date: '2026-01-15' },
      { date: '2026-04-15' },
    ]
    await writeBenchmarks(input)
    expect(input.map((b) => b.date)).toEqual(['2026-01-15', '2026-04-15'])
  })
})

describe('isValidDate', () => {
  it.each(['2026-04-15', '2000-01-01', '9999-12-31'])('accepts ISO calendar date %s', (d) => {
    expect(isValidDate(d)).toBe(true)
  })

  it.each(['2026-4-15', '2026/04/15', '04-15-2026', '2026-04-15T00:00:00Z', '', 'today'])(
    'rejects non-ISO format %s',
    (d) => {
      expect(isValidDate(d)).toBe(false)
    },
  )
})

describe('isDevRuntime', () => {
  it('returns true under NODE_ENV=development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isDevRuntime()).toBe(true)
  })

  it('returns false under NODE_ENV=production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isDevRuntime()).toBe(false)
  })

  it('returns false under NODE_ENV=test (the default for vitest runs)', () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(isDevRuntime()).toBe(false)
  })
})
